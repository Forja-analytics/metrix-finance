'use client';

import { GraphQLClient, gql } from 'graphql-request';

// Uniswap V4 Position Manager address on Ethereum mainnet
const V4_POSITION_MANAGER_ETH = '0xbd216513d74c8cf14cf4747e6aaa6420ff64ee9e';

// The Graph decentralized network (requires API key)
const GRAPH_API_KEY = process.env.NEXT_PUBLIC_GRAPH_API_KEY;

// V4 Subgraph on The Graph - use the official Uniswap V4 Ethereum mainnet subgraph
// This is the current official subgraph from Uniswap docs: https://docs.uniswap.org/api/subgraph/overview
const V4_SUBGRAPH_ID = 'DiYPVdygkfjDWhbxGSqAQxwBKmfKnkWQojqeM2rkLb3G';
const V4_SUBGRAPH_URL = GRAPH_API_KEY
  ? `https://gateway.thegraph.com/api/${GRAPH_API_KEY}/subgraphs/id/${V4_SUBGRAPH_ID}`
  : null;

// Use the same subgraph for position lookups (unified endpoint)
const DECENTRALIZED_SUBGRAPH_URL = V4_SUBGRAPH_URL;

export interface V4PositionBasic {
  id: string;
  tokenId: string;
  owner: string;
}

// V4 Position history data with deposits and claims
export interface V4PositionHistory {
  tokenId: string;
  createdTimestamp: number;
  createdBlockNumber: number;
  mintTxHash: string;
  // Deposit amounts (from ModifyLiquidity events)
  depositedToken0: number;
  depositedToken1: number;
  // Original USD value at time of deposit (for P&L calculation)
  depositedUSD: number;
  // Claimed/withdrawn amounts (negative ModifyLiquidity = withdrawals including fees)
  claimedToken0: number;
  claimedToken1: number;
  // Tick range for matching
  tickLower: number;
  tickUpper: number;
}

// ModifyLiquidity event from V4 subgraph
interface ModifyLiquidityEvent {
  id: string;
  timestamp: string;
  amount: string;
  amount0: string;
  amount1: string;
  amountUSD: string | null;
  tickLower: string;
  tickUpper: string;
  transaction: {
    id: string;
  };
}

const POSITIONS_BY_OWNER_QUERY = gql`
  query GetPositionsByOwner($owner: String!) {
    positions(where: { owner: $owner }) {
      id
      tokenId
      owner
    }
  }
`;

// Query for V4 position with more details (if available in subgraph)
const V4_POSITION_DETAILS_QUERY = gql`
  query GetV4PositionDetails($tokenId: String!) {
    position(id: $tokenId) {
      id
      tokenId
      owner
      liquidity
      depositedToken0
      depositedToken1
      collectedFeesToken0
      collectedFeesToken1
      transaction {
        id
        timestamp
        blockNumber
      }
    }
  }
`;

// Query for position creation timestamp from V4 subgraph
const V4_POSITION_CREATED_QUERY = gql`
  query GetV4PositionCreated($tokenId: BigInt!) {
    positions(where: { tokenId: $tokenId }, first: 1) {
      id
      tokenId
      createdAtTimestamp
      origin
    }
  }
`;

// Query ModifyLiquidity events by user address (origin)
// This gives us deposit and withdrawal history for V4 positions
const MODIFY_LIQUIDITY_BY_ORIGIN_QUERY = gql`
  query GetModifyLiquidityByOrigin($origin: Bytes!, $first: Int!, $skip: Int!) {
    modifyLiquidities(
      where: { origin: $origin }
      first: $first
      skip: $skip
      orderBy: timestamp
      orderDirection: asc
    ) {
      id
      timestamp
      amount
      amount0
      amount1
      amountUSD
      tickLower
      tickUpper
      transaction {
        id
      }
    }
  }
`;

// Query ModifyLiquidity events filtered by tick range (for matching to specific position)
const MODIFY_LIQUIDITY_BY_TICKS_QUERY = gql`
  query GetModifyLiquidityByTicks($origin: Bytes!, $tickLower: BigInt!, $tickUpper: BigInt!, $first: Int!) {
    modifyLiquidities(
      where: {
        origin: $origin
        tickLower: $tickLower
        tickUpper: $tickUpper
      }
      first: $first
      orderBy: timestamp
      orderDirection: asc
    ) {
      id
      timestamp
      amount
      amount0
      amount1
      amountUSD
      tickLower
      tickUpper
      transaction {
        id
      }
    }
  }
`;

// Try to fetch from The Graph (requires API key)
async function tryFetchFromSubgraph(url: string, ownerAddress: string): Promise<V4PositionBasic[] | null> {
  try {
    const client = new GraphQLClient(url);
    const data = await client.request<{ positions: V4PositionBasic[] }>(
      POSITIONS_BY_OWNER_QUERY,
      { owner: ownerAddress.toLowerCase() }
    );
    return data.positions || [];
  } catch (error) {
    console.log(`Failed to fetch from subgraph:`, error);
    return null;
  }
}

// Helper for fetch with timeout
async function fetchWithTimeout(url: string, timeoutMs: number = 10000): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

// Fallback: Use Etherscan API to get NFT transfers
async function fetchV4PositionsFromEtherscan(ownerAddress: string): Promise<bigint[]> {
  try {
    // Etherscan API V2 - free tier allows 5 calls/sec
    // We'll look for ERC721 transfers TO the owner address
    const apiKey = process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY || '';
    const baseUrl = 'https://api.etherscan.io/v2/api';

    // Get ERC721 token transfers for the V4 Position Manager contract to this address
    // V2 API format
    const url = `${baseUrl}?chainid=1&module=account&action=tokennfttx&contractaddress=${V4_POSITION_MANAGER_ETH}&address=${ownerAddress}&sort=desc${apiKey ? `&apikey=${apiKey}` : ''}`;

    console.log('Fetching V4 positions from Etherscan V2 API...');
    const response = await fetchWithTimeout(url, 15000);
    const data = await response.json();

    if (data.status !== '1' || !data.result) {
      console.log('Etherscan returned no results or error:', data.message);
      return [];
    }

    // Parse transfers to find current ownership
    // Track which tokens the user currently owns (received but not sent away)
    const tokenOwnership = new Map<string, boolean>();

    for (const transfer of data.result) {
      const tokenId = transfer.tokenID;
      const to = transfer.to.toLowerCase();
      const from = transfer.from.toLowerCase();
      const userAddr = ownerAddress.toLowerCase();

      if (to === userAddr) {
        // User received this token
        tokenOwnership.set(tokenId, true);
      } else if (from === userAddr) {
        // User sent this token away
        tokenOwnership.set(tokenId, false);
      }
    }

    // Get tokens the user still owns
    const ownedTokenIds: bigint[] = [];
    for (const [tokenId, owned] of tokenOwnership) {
      if (owned) {
        ownedTokenIds.push(BigInt(tokenId));
      }
    }

    console.log('V4 positions from Etherscan:', ownedTokenIds);
    return ownedTokenIds;
  } catch (error) {
    console.error('Error fetching from Etherscan:', error);
    return [];
  }
}

// Alternative: Use Alchemy NFT API (if available)
async function fetchV4PositionsFromAlchemy(ownerAddress: string): Promise<bigint[]> {
  const alchemyKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;
  if (!alchemyKey) {
    console.log('[Alchemy] No API key configured, skipping');
    return [];
  }

  try {
    const url = `https://eth-mainnet.g.alchemy.com/nft/v3/${alchemyKey}/getNFTsForOwner?owner=${ownerAddress}&contractAddresses[]=${V4_POSITION_MANAGER_ETH}&withMetadata=false`;

    console.log('Fetching V4 positions from Alchemy...');
    const response = await fetchWithTimeout(url, 15000);

    if (!response.ok) {
      console.log('[Alchemy] API returned error status:', response.status);
      return [];
    }

    const data = await response.json();

    if (!data.ownedNfts) {
      console.log('Alchemy returned no NFTs');
      return [];
    }

    const tokenIds = data.ownedNfts.map((nft: any) => BigInt(nft.tokenId));
    console.log('V4 positions from Alchemy:', tokenIds);
    return tokenIds;
  } catch (error: unknown) {
    // Handle AbortError (timeout) separately
    if (error instanceof Error && error.name === 'AbortError') {
      console.log('[Alchemy] Request timed out');
    } else {
      console.log('[Alchemy] Fetch error (possibly network issue):', error instanceof Error ? error.message : 'Unknown error');
    }
    return [];
  }
}

export async function fetchV4PositionTokenIds(ownerAddress: string): Promise<bigint[]> {
  console.log('Fetching V4 positions for:', ownerAddress);

  // Delegate to server-side API route so API keys are read from runtime env vars
  try {
    const res = await fetch(`/api/v4-positions?address=${ownerAddress}`);
    if (res.ok) {
      const data = await res.json();
      if (data.tokenIds?.length > 0) {
        console.log(`V4 positions from server (${data.source}):`, data.tokenIds);
        return data.tokenIds.map((id: string) => BigInt(id));
      }
    }
  } catch (error) {
    console.log('Server API call failed, trying client-side fallbacks:', error);
  }

  // Client-side fallback: The Graph subgraph (if key was baked at build time)
  if (DECENTRALIZED_SUBGRAPH_URL) {
    console.log('Trying The Graph subgraph...');
    const positions = await tryFetchFromSubgraph(DECENTRALIZED_SUBGRAPH_URL, ownerAddress);
    if (positions !== null && positions.length > 0) {
      console.log('V4 positions from subgraph:', positions);
      return positions.map((pos) => BigInt(pos.tokenId));
    }
  }

  // Client-side fallback: Alchemy (if key was baked at build time)
  const alchemyPositions = await fetchV4PositionsFromAlchemy(ownerAddress);
  if (alchemyPositions.length > 0) {
    return alchemyPositions;
  }

  // Client-side fallback: Etherscan
  const etherscanPositions = await fetchV4PositionsFromEtherscan(ownerAddress);
  if (etherscanPositions.length > 0) {
    return etherscanPositions;
  }

  console.log('No V4 positions found via any method');
  return [];
}

// Fetch V4 position history using Etherscan
// This gets the mint transaction to determine creation date
export async function fetchV4PositionHistory(
  tokenId: string,
  ownerAddress: string
): Promise<V4PositionHistory | null> {
  try {
    const apiKey = process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY || '';
    const baseUrl = 'https://api.etherscan.io/v2/api';

    // Get NFT transfer events for this specific token (V2 API)
    const url = `${baseUrl}?chainid=1&module=account&action=tokennfttx&contractaddress=${V4_POSITION_MANAGER_ETH}&address=${ownerAddress}&sort=asc${apiKey ? `&apikey=${apiKey}` : ''}`;

    console.log(`Fetching V4 position history for token ${tokenId}...`);
    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== '1' || !data.result) {
      console.log('Etherscan returned no results:', data.message);
      return null;
    }

    // Find the mint transaction for this token (first transfer where from is 0x0)
    const mintTx = data.result.find((tx: any) =>
      tx.tokenID === tokenId &&
      tx.from === '0x0000000000000000000000000000000000000000'
    );

    if (!mintTx) {
      // If no mint found, find the first transfer TO the user for this token
      const firstTransfer = data.result.find((tx: any) =>
        tx.tokenID === tokenId &&
        tx.to.toLowerCase() === ownerAddress.toLowerCase()
      );

      if (firstTransfer) {
        return {
          tokenId,
          createdTimestamp: parseInt(firstTransfer.timeStamp) * 1000,
          createdBlockNumber: parseInt(firstTransfer.blockNumber),
          mintTxHash: firstTransfer.hash,
          depositedToken0: 0,
          depositedToken1: 0,
          depositedUSD: 0,
          claimedToken0: 0,
          claimedToken1: 0,
          tickLower: 0,
          tickUpper: 0,
        };
      }

      console.log(`No mint transaction found for token ${tokenId}`);
      return null;
    }

    return {
      tokenId,
      createdTimestamp: parseInt(mintTx.timeStamp) * 1000,
      createdBlockNumber: parseInt(mintTx.blockNumber),
      mintTxHash: mintTx.hash,
      depositedToken0: 0,
      depositedToken1: 0,
      depositedUSD: 0,
      claimedToken0: 0,
      claimedToken1: 0,
      tickLower: 0,
      tickUpper: 0,
    };
  } catch (error) {
    console.error(`Error fetching V4 position history for token ${tokenId}:`, error);
    return null;
  }
}

// Track if we've already logged that modifyLiquidities is not available
let modifyLiquiditiesUnavailableLogged = false;

// Fetch ModifyLiquidity events from V4 subgraph for a user
async function fetchModifyLiquidityEvents(
  ownerAddress: string
): Promise<ModifyLiquidityEvent[]> {
  if (!V4_SUBGRAPH_URL) {
    console.log('No V4 subgraph URL configured');
    return [];
  }

  try {
    const client = new GraphQLClient(V4_SUBGRAPH_URL);
    const allEvents: ModifyLiquidityEvent[] = [];
    let skip = 0;
    const first = 1000;

    // Paginate through all events
    while (true) {
      const data = await client.request<{ modifyLiquidities: ModifyLiquidityEvent[] }>(
        MODIFY_LIQUIDITY_BY_ORIGIN_QUERY,
        {
          origin: ownerAddress.toLowerCase(),
          first,
          skip,
        }
      );

      const events = data.modifyLiquidities || [];
      allEvents.push(...events);

      if (events.length < first) break;
      skip += first;
    }

    console.log(`Found ${allEvents.length} ModifyLiquidity events for user`);
    return allEvents;
  } catch (error: unknown) {
    // Check if this is a schema error (field doesn't exist)
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes('has no field') || errorMessage.includes('modifyLiquidities')) {
      // This subgraph doesn't have modifyLiquidities - log once and return empty
      if (!modifyLiquiditiesUnavailableLogged) {
        console.log('[V4 Subgraph] modifyLiquidities query not available in this subgraph - using fallback data');
        modifyLiquiditiesUnavailableLogged = true;
      }
      return [];
    }
    // For other errors, log them
    console.error('Error fetching ModifyLiquidity events:', error);
    return [];
  }
}

// Calculate deposits and claims from ModifyLiquidity events for a specific tick range
function calculateDepositsAndClaims(
  events: ModifyLiquidityEvent[],
  tickLower: number,
  tickUpper: number
): { depositedToken0: number; depositedToken1: number; depositedUSD: number; claimedToken0: number; claimedToken1: number } {
  let depositedToken0 = 0;
  let depositedToken1 = 0;
  let depositedUSD = 0;
  let claimedToken0 = 0;
  let claimedToken1 = 0;

  // Filter events matching this position's tick range
  const matchingEvents = events.filter(
    (e) => parseInt(e.tickLower) === tickLower && parseInt(e.tickUpper) === tickUpper
  );

  for (const event of matchingEvents) {
    const amount0 = parseFloat(event.amount0);
    const amount1 = parseFloat(event.amount1);
    const amountUSD = parseFloat(event.amountUSD || '0') || 0;

    // Positive amounts = deposits, negative = withdrawals
    if (amount0 > 0 || amount1 > 0) {
      // This is a deposit event
      depositedToken0 += Math.max(0, amount0);
      depositedToken1 += Math.max(0, amount1);
      depositedUSD += Math.abs(amountUSD); // Track USD value at deposit time
    } else {
      // This is a withdrawal/claim event
      claimedToken0 += Math.abs(amount0);
      claimedToken1 += Math.abs(amount1);
    }
  }

  return { depositedToken0, depositedToken1, depositedUSD, claimedToken0, claimedToken1 };
}

// Helper to fetch position creation time from V4 subgraph
async function fetchV4PositionCreatedFromSubgraph(tokenId: string): Promise<number | null> {
  if (!V4_SUBGRAPH_URL) return null;

  try {
    const client = new GraphQLClient(V4_SUBGRAPH_URL);
    const data = await client.request<{ positions: Array<{ createdAtTimestamp: string }> }>(
      V4_POSITION_CREATED_QUERY,
      { tokenId: tokenId }
    );

    if (data.positions && data.positions.length > 0 && data.positions[0].createdAtTimestamp) {
      const timestamp = parseInt(data.positions[0].createdAtTimestamp) * 1000;
      console.log(`[V4 Subgraph] Found position ${tokenId} created at ${new Date(timestamp).toISOString()}`);
      return timestamp;
    }
  } catch (error) {
    // Silently fail - subgraph might not have this field
    console.log(`[V4 Subgraph] Could not fetch creation time for position ${tokenId}`);
  }
  return null;
}

// Batch fetch V4 position histories with deposits and claims
export async function fetchV4PositionsHistory(
  tokenIds: string[],
  ownerAddress: string,
  positions?: Array<{ tokenId: string; tickLower: number; tickUpper: number }>
): Promise<Map<string, V4PositionHistory>> {
  const results = new Map<string, V4PositionHistory>();

  try {
    // Step 1: Try to get creation timestamps from V4 subgraph first
    const subgraphTimestamps = new Map<string, number>();
    for (const tokenId of tokenIds) {
      const timestamp = await fetchV4PositionCreatedFromSubgraph(tokenId);
      if (timestamp) {
        subgraphTimestamps.set(tokenId, timestamp);
      }
    }

    // Step 2: Get mint timestamps from Etherscan (as fallback)
    const apiKey = process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY || '';
    const baseUrl = 'https://api.etherscan.io/v2/api';
    const url = `${baseUrl}?chainid=1&module=account&action=tokennfttx&contractaddress=${V4_POSITION_MANAGER_ETH}&address=${ownerAddress}&sort=asc${apiKey ? `&apikey=${apiKey}` : ''}`;

    console.log('Fetching V4 positions history from Etherscan V2 API...');
    const response = await fetch(url);
    const data = await response.json();

    const mintData = new Map<string, { timestamp: number; blockNumber: number; hash: string }>();

    if (data.status === '1' && data.result) {
      console.log(`[Etherscan] Found ${data.result.length} NFT transfers for V4 Position Manager`);

      for (const tokenId of tokenIds) {
        // Normalize tokenId for comparison (both as string without leading zeros)
        const normalizedTokenId = BigInt(tokenId).toString();

        // Find mint transaction (from address 0x0)
        const mintTx = data.result.find((tx: any) => {
          const txTokenId = BigInt(tx.tokenID).toString();
          return txTokenId === normalizedTokenId &&
            tx.from.toLowerCase() === '0x0000000000000000000000000000000000000000';
        });

        // If no mint, find any transfer TO the user
        const transferTx = mintTx || data.result.find((tx: any) => {
          const txTokenId = BigInt(tx.tokenID).toString();
          return txTokenId === normalizedTokenId &&
            tx.to.toLowerCase() === ownerAddress.toLowerCase();
        });

        if (transferTx) {
          const timestamp = parseInt(transferTx.timeStamp) * 1000;
          console.log(`[Etherscan] Found position ${tokenId} transfer at ${new Date(timestamp).toISOString()}`);
          mintData.set(tokenId, {
            timestamp,
            blockNumber: parseInt(transferTx.blockNumber),
            hash: transferTx.hash,
          });
        } else {
          console.log(`[Etherscan] No transfer found for position ${tokenId}`);
        }
      }
    } else {
      console.log(`[Etherscan] API response status: ${data.status}, message: ${data.message}`);
    }

    // Step 3: Fetch ModifyLiquidity events from V4 subgraph
    const modifyEvents = await fetchModifyLiquidityEvents(ownerAddress);

    // Step 4: Match events to positions and calculate deposits/claims
    for (const tokenId of tokenIds) {
      // Prefer subgraph timestamp, fallback to Etherscan
      const subgraphTs = subgraphTimestamps.get(tokenId);
      const etherscanData = mintData.get(tokenId);
      const createdTimestamp = subgraphTs || etherscanData?.timestamp || 0;

      const positionInfo = positions?.find((p) => p.tokenId === tokenId);

      // Default values
      let depositedToken0 = 0;
      let depositedToken1 = 0;
      let depositedUSD = 0;
      let claimedToken0 = 0;
      let claimedToken1 = 0;
      let tickLower = 0;
      let tickUpper = 0;

      if (positionInfo && modifyEvents.length > 0) {
        tickLower = positionInfo.tickLower;
        tickUpper = positionInfo.tickUpper;

        const calculated = calculateDepositsAndClaims(modifyEvents, tickLower, tickUpper);
        depositedToken0 = calculated.depositedToken0;
        depositedToken1 = calculated.depositedToken1;
        depositedUSD = calculated.depositedUSD;
        claimedToken0 = calculated.claimedToken0;
        claimedToken1 = calculated.claimedToken1;

        console.log(`V4 Position ${tokenId} (ticks ${tickLower}-${tickUpper}): deposits=${depositedToken0}/${depositedToken1} ($${depositedUSD}), claims=${claimedToken0}/${claimedToken1}`);
      }

      // Log final timestamp source
      if (createdTimestamp > 0) {
        console.log(`[V4 History] Position ${tokenId} created: ${new Date(createdTimestamp).toISOString()} (source: ${subgraphTs ? 'subgraph' : 'etherscan'})`);
      } else {
        console.log(`[V4 History] Position ${tokenId}: creation time UNKNOWN - will use default 30 days`);
      }

      results.set(tokenId, {
        tokenId,
        createdTimestamp,
        createdBlockNumber: etherscanData?.blockNumber || 0,
        mintTxHash: etherscanData?.hash || '',
        depositedToken0,
        depositedToken1,
        depositedUSD,
        claimedToken0,
        claimedToken1,
        tickLower,
        tickUpper,
      });
    }

    console.log(`Found history for ${results.size} V4 positions`);
    return results;
  } catch (error) {
    console.error('Error fetching V4 positions history:', error);
    return results;
  }
}

// Try to get V4 position details from subgraph (if available)
export async function fetchV4PositionDetailsFromSubgraph(
  tokenId: string
): Promise<{
  depositedToken0: number;
  depositedToken1: number;
  collectedFeesToken0: number;
  collectedFeesToken1: number;
  createdTimestamp: number;
} | null> {
  if (!DECENTRALIZED_SUBGRAPH_URL) return null;

  try {
    const client = new GraphQLClient(DECENTRALIZED_SUBGRAPH_URL);
    const data = await client.request<{ position: any }>(
      V4_POSITION_DETAILS_QUERY,
      { tokenId }
    );

    if (!data.position) return null;

    return {
      depositedToken0: parseFloat(data.position.depositedToken0) || 0,
      depositedToken1: parseFloat(data.position.depositedToken1) || 0,
      collectedFeesToken0: parseFloat(data.position.collectedFeesToken0) || 0,
      collectedFeesToken1: parseFloat(data.position.collectedFeesToken1) || 0,
      createdTimestamp: data.position.transaction?.timestamp
        ? parseInt(data.position.transaction.timestamp) * 1000
        : Date.now(),
    };
  } catch (error) {
    // Subgraph might not have these fields - that's OK
    console.log('V4 subgraph does not have detailed position data');
    return null;
  }
}
