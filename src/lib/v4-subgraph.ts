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
  pool?: {
    id: string;
    token0?: { id: string; symbol: string; decimals: string };
    token1?: { id: string; symbol: string; decimals: string };
  };
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
      pool {
        id
        token0 { id symbol decimals }
        token1 { id symbol decimals }
      }
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

// ERC20 Transfer event topic (keccak256 of "Transfer(address,address,uint256)")
const ERC20_TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

// WETH address on Ethereum mainnet — V4 uses address(0) for native ETH in pool tokens,
// but on-chain fee claims transfer WETH, so we need to map 0x0 → WETH for matching.
const WETH_ADDRESS = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';
const NATIVE_ETH_ADDRESS = '0x0000000000000000000000000000000000000000';

// Public Ethereum RPC endpoints (fallback chain)
const PUBLIC_RPCS = [
  'https://ethereum-rpc.publicnode.com',
  'https://cloudflare-eth.com',
  'https://rpc.mevblocker.io',
];

// Fetch actual claimed fee amounts from V4 fee-claim transactions via RPC.
// The V4 subgraph reports amount0=0, amount1=0 for pure fee collections because
// the token transfer happens in the settle/take step, not in modifyLiquidity.
// This function reads ERC20 Transfer logs from the tx receipt to get real amounts.
async function fetchClaimedFeesFromRPC(
  feeClaimTxHashes: string[],
  ownerAddress: string,
  token0Address: string,
  token1Address: string,
  token0Decimals: number,
  token1Decimals: number
): Promise<{ claimedToken0: number; claimedToken1: number }> {
  if (feeClaimTxHashes.length === 0) return { claimedToken0: 0, claimedToken1: 0 };

  const owner = ownerAddress.toLowerCase();
  // V4 uses address(0) for native ETH, but on-chain fee claims use WETH
  const t0 = token0Address.toLowerCase() === NATIVE_ETH_ADDRESS ? WETH_ADDRESS : token0Address.toLowerCase();
  const t1 = token1Address.toLowerCase() === NATIVE_ETH_ADDRESS ? WETH_ADDRESS : token1Address.toLowerCase();
  let claimedToken0 = 0;
  let claimedToken1 = 0;

  // Try each RPC until one works
  for (const rpcUrl of PUBLIC_RPCS) {
    try {
      let allSucceeded = true;

      for (const txHash of feeClaimTxHashes) {
        const res = await fetch(rpcUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'eth_getTransactionReceipt',
            params: [txHash],
            id: 1,
          }),
        });
        const data = await res.json();
        const receipt = data.result;

        if (!receipt) {
          allSucceeded = false;
          break;
        }

        // Parse ERC20 Transfer logs for tokens sent to the wallet owner
        for (const log of receipt.logs) {
          if (log.topics[0] !== ERC20_TRANSFER_TOPIC || log.topics.length < 3) continue;
          const to = ('0x' + log.topics[2].slice(26)).toLowerCase();
          if (to !== owner) continue;

          const tokenAddr = log.address.toLowerCase();
          const rawValue = BigInt(log.data);

          if (tokenAddr === t0) {
            claimedToken0 += Number(rawValue) / Math.pow(10, token0Decimals);
          } else if (tokenAddr === t1) {
            claimedToken1 += Number(rawValue) / Math.pow(10, token1Decimals);
          }
        }
      }

      if (allSucceeded) {
        console.log(`[V4 RPC] Resolved ${feeClaimTxHashes.length} fee claims via ${rpcUrl}: token0=${claimedToken0}, token1=${claimedToken1}`);
        return { claimedToken0, claimedToken1 };
      }
    } catch (e) {
      console.log(`[V4 RPC] ${rpcUrl} failed: ${e instanceof Error ? e.message : 'unknown'}`);
    }
  }

  console.warn(`[V4 RPC] Could not resolve fee claims from any RPC`);
  return { claimedToken0: 0, claimedToken1: 0 };
}

// Calculate deposits and claims from ModifyLiquidity events for a specific tick range
// IMPORTANT: In V4, ModifyLiquidity events represent both liquidity changes AND fee claims.
// When `amount` (liquidityDelta) is 0 but amount0/amount1 are non-zero, this is a pure fee collection.
// When `amount` is negative, tokens are withdrawn (liquidity removal + any accumulated fees).
// We separate fee claims from liquidity withdrawals to avoid inflating "claimed fees" with principal.
function calculateDepositsAndClaims(
  events: ModifyLiquidityEvent[],
  tickLower: number,
  tickUpper: number,
  poolId?: string
): { depositedToken0: number; depositedToken1: number; depositedUSD: number; claimedToken0: number; claimedToken1: number } {
  let depositedToken0 = 0;
  let depositedToken1 = 0;
  let depositedUSD = 0;
  let claimedToken0 = 0;
  let claimedToken1 = 0;

  // Filter events matching this position's tick range and pool (if available)
  const matchingEvents = events.filter((e) => {
    const tickMatch = parseInt(e.tickLower) === tickLower && parseInt(e.tickUpper) === tickUpper;
    if (!tickMatch) return false;
    // If poolId provided and event has pool info, filter by pool to avoid cross-pool mixing
    if (poolId && e.pool?.id) {
      return e.pool.id.toLowerCase() === poolId.toLowerCase();
    }
    return true; // Graceful degradation if pool info unavailable
  });

  // Track total deposited tokens to distinguish withdrawal of principal vs fee claims
  let cumulativeDeposited0 = 0;
  let cumulativeDeposited1 = 0;
  let cumulativeWithdrawn0 = 0;
  let cumulativeWithdrawn1 = 0;

  for (const event of matchingEvents) {
    const amount0 = parseFloat(event.amount0);
    const amount1 = parseFloat(event.amount1);
    const liquidityDelta = parseFloat(event.amount); // The liquidity change
    const amountUSD = parseFloat(event.amountUSD || '0') || 0;

    if (liquidityDelta === 0 && (amount0 !== 0 || amount1 !== 0)) {
      // Pure fee collection event: liquidity unchanged but tokens moved
      // All tokens in this event are claimed fees
      claimedToken0 += Math.abs(amount0);
      claimedToken1 += Math.abs(amount1);
    } else if (amount0 > 0 || amount1 > 0) {
      // Deposit event: adding liquidity
      depositedToken0 += Math.max(0, amount0);
      depositedToken1 += Math.max(0, amount1);
      cumulativeDeposited0 += Math.max(0, amount0);
      cumulativeDeposited1 += Math.max(0, amount1);
      depositedUSD += Math.abs(amountUSD);
    } else if (amount0 < 0 || amount1 < 0) {
      // Withdrawal event: removing liquidity
      // In concentrated liquidity, the token composition changes with price (IL).
      // We CANNOT reliably separate fees from principal using token amounts alone,
      // because "excess" tokens are mostly IL rebalancing, not fees.
      // Real claimed fees are resolved via RPC transaction receipts instead.
      const withdrawn0 = Math.abs(amount0);
      const withdrawn1 = Math.abs(amount1);
      cumulativeWithdrawn0 += withdrawn0;
      cumulativeWithdrawn1 += withdrawn1;
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

// Result type that includes fetch status for UI error surfacing
export interface V4PositionsHistoryResult {
  data: Map<string, V4PositionHistory>;
  success: boolean;
  error?: string;
}

// Batch fetch V4 position histories with deposits and claims
export async function fetchV4PositionsHistory(
  tokenIds: string[],
  ownerAddress: string,
  positions?: Array<{ tokenId: string; tickLower: number; tickUpper: number; poolId?: string }>
): Promise<V4PositionsHistoryResult> {
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

        // For placeholder positions (Bug #9: on-chain data cleared), tick range is [0,0].
        // Infer the real tick range from the first deposit event at the position's creation time.
        // In V4, the NFT mint and first deposit happen in the same transaction (same timestamp).
        if (tickLower === 0 && tickUpper === 0 && createdTimestamp > 0) {
          const createdTimeSec = Math.floor(createdTimestamp / 1000); // convert ms to seconds
          const firstDeposit = modifyEvents.find(e =>
            parseInt(e.timestamp) === createdTimeSec && parseFloat(e.amount) > 0
          );
          if (firstDeposit) {
            tickLower = parseInt(firstDeposit.tickLower);
            tickUpper = parseInt(firstDeposit.tickUpper);
            console.log(`[AUDIT] V4 position ${tokenId}: inferred tick range [${tickLower},${tickUpper}] from first deposit event at ${new Date(createdTimestamp).toISOString()}`);
          } else {
            // Fallback: find any deposit event closest to creation time
            const sortedDeposits = modifyEvents
              .filter(e => parseFloat(e.amount) > 0)
              .sort((a, b) => Math.abs(parseInt(a.timestamp) - createdTimeSec) - Math.abs(parseInt(b.timestamp) - createdTimeSec));
            if (sortedDeposits.length > 0) {
              tickLower = parseInt(sortedDeposits[0].tickLower);
              tickUpper = parseInt(sortedDeposits[0].tickUpper);
              console.log(`[AUDIT] V4 position ${tokenId}: inferred tick range [${tickLower},${tickUpper}] from closest deposit event (${Math.abs(parseInt(sortedDeposits[0].timestamp) - createdTimeSec)}s delta)`);
            } else {
              console.warn(`[AUDIT] V4 position ${tokenId}: no deposit events found to infer tick range`);
            }
          }
        }

        const calculated = calculateDepositsAndClaims(modifyEvents, tickLower, tickUpper, positionInfo.poolId);
        depositedToken0 = calculated.depositedToken0;
        depositedToken1 = calculated.depositedToken1;
        depositedUSD = calculated.depositedUSD;
        claimedToken0 = calculated.claimedToken0;
        claimedToken1 = calculated.claimedToken1;

        // Step 5: Resolve claimed fees via RPC transaction receipts (V4 subgraph limitation)
        // The V4 subgraph reports amount0=0, amount1=0 for pure fee collections, and
        // withdrawal amounts conflate principal with fees (IL token rebalancing).
        // The only reliable source for actual fee amounts is the ERC20 Transfer logs in tx receipts.
        const matchingEvents = modifyEvents.filter((e) => {
          const tickMatch = parseInt(e.tickLower) === tickLower && parseInt(e.tickUpper) === tickUpper;
          if (!tickMatch) return false;
          if (positionInfo.poolId && e.pool?.id) {
            return e.pool.id.toLowerCase() === positionInfo.poolId.toLowerCase();
          }
          return true;
        });

        // Only resolve pure fee claims (amount=0) via RPC.
        // Withdrawals (amount<0) mix principal + fees in a single transfer,
        // so we can't separate them from Transfer logs alone.
        const feeRelatedTxs = matchingEvents.filter(e => {
          const liqDelta = parseFloat(e.amount);
          const a0 = parseFloat(e.amount0);
          const a1 = parseFloat(e.amount1);
          return liqDelta === 0 && a0 === 0 && a1 === 0; // pure fee claims only
        });

        if (feeRelatedTxs.length > 0) {
          const poolEvent = matchingEvents.find(e => e.pool?.token0?.id && e.pool?.token1?.id);
          if (poolEvent?.pool?.token0 && poolEvent?.pool?.token1) {
            const t0Addr = poolEvent.pool.token0.id;
            const t1Addr = poolEvent.pool.token1.id;
            const t0Dec = parseInt(poolEvent.pool.token0.decimals) || 18;
            const t1Dec = parseInt(poolEvent.pool.token1.decimals) || 18;
            const txHashes = feeRelatedTxs.map(e => e.transaction.id);

            console.log(`[V4] Position ${tokenId}: resolving fees from ${feeRelatedTxs.length} txs via RPC...`);
            const rpcFees = await fetchClaimedFeesFromRPC(txHashes, ownerAddress, t0Addr, t1Addr, t0Dec, t1Dec);
            claimedToken0 += rpcFees.claimedToken0;
            claimedToken1 += rpcFees.claimedToken1;
          }
        }

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
    return { data: results, success: results.size > 0 };
  } catch (error) {
    console.error('Error fetching V4 positions history:', error);
    return { data: results, success: false, error: `V4 history fetch failed: ${error instanceof Error ? error.message : 'unknown'}` };
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
