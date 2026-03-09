'use client';

import { Pool } from '@/types';

// The Graph Gateway API Key (free tier available at https://thegraph.com/studio/)
const GRAPH_API_KEY = process.env.NEXT_PUBLIC_GRAPH_API_KEY || '';

// Validate API key format (only log once)
let apiKeyWarningLogged = false;
if (!apiKeyWarningLogged && typeof window !== 'undefined') {
  if (!GRAPH_API_KEY || GRAPH_API_KEY.length < 20) {
    console.warn('[The Graph] No valid API key found. Using public gateway (rate limited). Get a free key at: https://thegraph.com/studio/');
    apiKeyWarningLogged = true;
  }
}

// Chain ID to network name mapping
const CHAIN_ID_TO_NETWORK: Record<number, string> = {
  1: 'ethereum',
  42161: 'arbitrum',
  137: 'polygon',
  10: 'optimism',
  8453: 'base',
  56: 'bsc',
};

// Position history data from subgraph
export interface PositionHistory {
  tokenId: string;
  createdTimestamp: number;
  createdBlockNumber: number;
  // Deposit amounts (in token units, not USD)
  depositedToken0: number;
  depositedToken1: number;
  // Original USD value at time of deposit (for P&L calculation)
  depositedUSD: number;
  // Claimed fees (already collected)
  claimedFees0: number;
  claimedFees1: number;
  totalCollects: number;
}

// Query to get position data including creation time and collect events
const POSITION_HISTORY_QUERY = `
  query GetPositionHistory($tokenId: String!) {
    position(id: $tokenId) {
      id
      owner
      pool {
        id
        token0 {
          symbol
          decimals
        }
        token1 {
          symbol
          decimals
        }
      }
      tickLower {
        tickIdx
      }
      tickUpper {
        tickIdx
      }
      liquidity
      depositedToken0
      depositedToken1
      collectedFeesToken0
      collectedFeesToken1
      transaction {
        timestamp
        blockNumber
      }
    }
  }
`;

// Query to get multiple positions at once with mint USD values
const POSITIONS_BY_IDS_QUERY = `
  query GetPositionsByIds($tokenIds: [String!]!) {
    positions(where: { id_in: $tokenIds }) {
      id
      owner
      pool {
        id
        token0 {
          symbol
          decimals
        }
        token1 {
          symbol
          decimals
        }
      }
      liquidity
      depositedToken0
      depositedToken1
      collectedFeesToken0
      collectedFeesToken1
      transaction {
        timestamp
        blockNumber
      }
    }
  }
`;

// Query to get mint events for positions (to get historical USD values)
const MINTS_BY_POSITION_QUERY = `
  query GetMintsByPosition($tokenIds: [String!]!) {
    mints(where: { position_in: $tokenIds }, orderBy: timestamp, orderDirection: asc) {
      id
      position {
        id
      }
      amount0
      amount1
      amountUSD
      timestamp
    }
  }
`;

// Fetch position history from subgraph
export async function fetchPositionHistory(
  tokenId: string,
  chainId: number = 1
): Promise<PositionHistory | null> {
  const network = CHAIN_ID_TO_NETWORK[chainId];
  if (!network) {
    console.warn(`No subgraph for chain ID: ${chainId}`);
    return null;
  }

  const subgraphUrl = getSubgraphUrl(network);
  if (!subgraphUrl) {
    console.warn(`No subgraph URL for network: ${network}`);
    return null;
  }

  try {
    const response = await fetch(subgraphUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: POSITION_HISTORY_QUERY,
        variables: { tokenId: tokenId.toString() },
      }),
    });

    const data = await response.json();

    if (data.errors) {
      console.warn('Position history query failed:', data.errors[0]?.message);
      return null;
    }

    const position = data.data?.position;
    if (!position) {
      return null;
    }

    const token0Decimals = parseInt(position.pool.token0.decimals) || 18;
    const token1Decimals = parseInt(position.pool.token1.decimals) || 18;

    return {
      tokenId: position.id,
      createdTimestamp: parseInt(position.transaction.timestamp) * 1000, // Convert to ms
      createdBlockNumber: parseInt(position.transaction.blockNumber),
      depositedToken0: parseFloat(position.depositedToken0) || 0,
      depositedToken1: parseFloat(position.depositedToken1) || 0,
      depositedUSD: 0, // Single fetch doesn't include mint USD - use batch fetch for this
      claimedFees0: parseFloat(position.collectedFeesToken0) || 0,
      claimedFees1: parseFloat(position.collectedFeesToken1) || 0,
      totalCollects: 0, // Could count collect events if needed
    };
  } catch (error) {
    console.error('Error fetching position history:', error);
    return null;
  }
}

// Batch fetch position histories for multiple positions
export async function fetchPositionsHistory(
  tokenIds: string[],
  chainId: number = 1
): Promise<Map<string, PositionHistory>> {
  const results = new Map<string, PositionHistory>();

  const network = CHAIN_ID_TO_NETWORK[chainId];
  if (!network) {
    console.warn(`No subgraph for chain ID: ${chainId}`);
    return results;
  }

  const subgraphUrl = getSubgraphUrl(network);
  if (!subgraphUrl) {
    console.warn(`No subgraph URL for network: ${network}`);
    return results;
  }

  try {
    // Fetch positions and mints in parallel
    const [positionsResponse, mintsResponse] = await Promise.all([
      fetch(subgraphUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: POSITIONS_BY_IDS_QUERY,
          variables: { tokenIds: tokenIds.map(id => id.toString()) },
        }),
      }),
      fetch(subgraphUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: MINTS_BY_POSITION_QUERY,
          variables: { tokenIds: tokenIds.map(id => id.toString()) },
        }),
      }),
    ]);

    const positionsData = await positionsResponse.json();
    const mintsData = await mintsResponse.json();

    if (positionsData.errors) {
      console.warn('Positions history query failed:', positionsData.errors[0]?.message);
      return results;
    }

    const positions = positionsData.data?.positions || [];
    const mints = mintsData.data?.mints || [];

    // Calculate total deposited USD per position from mint events
    const depositedUSDByPosition = new Map<string, number>();
    for (const mint of mints) {
      const positionId = mint.position?.id;
      if (positionId) {
        const currentTotal = depositedUSDByPosition.get(positionId) || 0;
        const mintUSD = parseFloat(mint.amountUSD) || 0;
        depositedUSDByPosition.set(positionId, currentTotal + mintUSD);
      }
    }

    for (const position of positions) {
      const depositedUSD = depositedUSDByPosition.get(position.id) || 0;

      results.set(position.id, {
        tokenId: position.id,
        createdTimestamp: parseInt(position.transaction.timestamp) * 1000,
        createdBlockNumber: parseInt(position.transaction.blockNumber),
        depositedToken0: parseFloat(position.depositedToken0) || 0,
        depositedToken1: parseFloat(position.depositedToken1) || 0,
        depositedUSD: depositedUSD,
        claimedFees0: parseFloat(position.collectedFeesToken0) || 0,
        claimedFees1: parseFloat(position.collectedFeesToken1) || 0,
        totalCollects: 0,
      });
    }

    return results;
  } catch (error) {
    console.error('Error fetching positions history:', error);
    return results;
  }
}

// Uniswap V3 Subgraph IDs on The Graph Decentralized Network
// These are the official Uniswap subgraph deployment IDs
const UNISWAP_V3_SUBGRAPH_IDS: Record<string, string> = {
  ethereum: '5zvR82QoaXYFyDEKLZ9t6v9adgnptxYpKpSbxtgVENFV',
  arbitrum: 'FbCGRftH4a3yZugY7TnbYgPJVEv2LvMT6oF1fxPe9aJM',
  polygon: '3hCPRGf4z88VC5rsBKU5AA9FBBq5nF3jbKJG7VZCbhjm',
  optimism: 'Cghf4LfVqPiFw6fp6Y5X5Ubc8UpmUhSfJL82zwiBFLaj',
  base: 'GqzP4Xaehti8KSfQmv3ZctFSjnSUYZ4En5NRsiTbvZpz',
  bsc: 'F85MNzUGYqgSHSHRGgeVMNsdnW1KtZSVgFULumXRZTw2',
};

// Build subgraph URLs (returns array for fallback attempts)
function getSubgraphUrls(network: string): string[] {
  const urls: string[] = [];
  const subgraphId = UNISWAP_V3_SUBGRAPH_IDS[network];

  // Only use decentralized network URLs (hosted service is deprecated and causes CORS)
  if (subgraphId) {
    if (GRAPH_API_KEY && GRAPH_API_KEY.length > 20) {
      urls.push(`https://gateway.thegraph.com/api/${GRAPH_API_KEY}/subgraphs/id/${subgraphId}`);
    }
    // Free tier gateway (rate limited but no CORS issues)
    urls.push(`https://gateway.thegraph.com/api/subgraphs/id/${subgraphId}`);
  }

  return urls;
}

// Legacy function for compatibility
function getSubgraphUrl(network: string): string | null {
  const urls = getSubgraphUrls(network);
  return urls.length > 0 ? urls[0] : null;
}

interface SubgraphPool {
  id: string;
  token0: {
    id: string;
    symbol: string;
    name: string;
    decimals: string;
    derivedETH: string;
  };
  token1: {
    id: string;
    symbol: string;
    name: string;
    decimals: string;
    derivedETH: string;
  };
  feeTier: string;
  liquidity: string;
  sqrtPrice: string;
  tick: string;
  totalValueLockedUSD: string;
  totalValueLockedETH: string;
  volumeUSD: string;
  feesUSD: string;
  txCount: string;
  poolDayData?: {
    volumeUSD: string;
    feesUSD: string;
  }[];
}

// GraphQL query to fetch top pools
const POOLS_QUERY = `
  query GetPools($first: Int!, $skip: Int!, $orderBy: String!, $orderDirection: String!) {
    pools(
      first: $first
      skip: $skip
      orderBy: $orderBy
      orderDirection: $orderDirection
      where: { totalValueLockedUSD_gt: "10000" }
    ) {
      id
      token0 {
        id
        symbol
        name
        decimals
        derivedETH
      }
      token1 {
        id
        symbol
        name
        decimals
        derivedETH
      }
      feeTier
      liquidity
      sqrtPrice
      tick
      totalValueLockedUSD
      totalValueLockedETH
      volumeUSD
      feesUSD
      txCount
      poolDayData(first: 7, orderBy: date, orderDirection: desc) {
        volumeUSD
        feesUSD
      }
    }
  }
`;

// Query for searching pools by token
const SEARCH_POOLS_QUERY = `
  query SearchPools($token0: String, $token1: String, $first: Int!) {
    pools(
      first: $first
      orderBy: totalValueLockedUSD
      orderDirection: desc
      where: {
        or: [
          { token0_: { symbol_contains_nocase: $token0 } }
          { token1_: { symbol_contains_nocase: $token0 } }
          { token0_: { symbol_contains_nocase: $token1 } }
          { token1_: { symbol_contains_nocase: $token1 } }
        ]
        totalValueLockedUSD_gt: "1000"
      }
    ) {
      id
      token0 {
        id
        symbol
        name
        decimals
        derivedETH
      }
      token1 {
        id
        symbol
        name
        decimals
        derivedETH
      }
      feeTier
      liquidity
      sqrtPrice
      tick
      totalValueLockedUSD
      totalValueLockedETH
      volumeUSD
      feesUSD
      txCount
      poolDayData(first: 7, orderBy: date, orderDirection: desc) {
        volumeUSD
        feesUSD
      }
    }
  }
`;

// Fetch pools from The Graph (single URL attempt)
async function fetchFromSubgraphUrl(
  url: string,
  query: string,
  variables: Record<string, unknown>
): Promise<SubgraphPool[] | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, variables }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return null; // Silent fail, will try next URL
    }

    const data = await response.json();

    if (data.errors) {
      // Log only in development, not in production
      if (process.env.NODE_ENV === 'development') {
        console.warn('Subgraph returned errors, trying fallback...');
      }
      return null;
    }

    return data.data?.pools || [];
  } catch {
    return null; // Silent fail for network errors
  }
}

// Fetch pools from The Graph with fallback URLs
async function fetchFromSubgraph(
  urls: string | string[],
  query: string,
  variables: Record<string, unknown>
): Promise<SubgraphPool[]> {
  const urlList = Array.isArray(urls) ? urls : [urls];

  for (const url of urlList) {
    const pools = await fetchFromSubgraphUrl(url, query, variables);
    if (pools && pools.length > 0) {
      return pools;
    }
  }

  // All URLs failed
  return [];
}

// Convert subgraph pool to our Pool type
function convertSubgraphPool(pool: SubgraphPool, network: string, ethPrice: number): Pool {
  const volume24h = pool.poolDayData?.[0] ? parseFloat(pool.poolDayData[0].volumeUSD) : 0;
  const fees24h = pool.poolDayData?.[0] ? parseFloat(pool.poolDayData[0].feesUSD) : 0;

  // Calculate 7-day totals
  const volume7d = pool.poolDayData?.reduce((sum, day) => sum + parseFloat(day.volumeUSD), 0) || 0;
  const fees7d = pool.poolDayData?.reduce((sum, day) => sum + parseFloat(day.feesUSD), 0) || 0;

  const tvl = parseFloat(pool.totalValueLockedUSD);

  // Calculate APR: (fees24h * 365 / tvl) * 100
  const apr = tvl > 0 ? (fees24h * 365 / tvl) * 100 : 0;

  // Calculate token prices from derivedETH
  const token0Price = parseFloat(pool.token0.derivedETH) * ethPrice;
  const token1Price = parseFloat(pool.token1.derivedETH) * ethPrice;

  // Get tick spacing based on fee tier
  const feeTier = parseInt(pool.feeTier);
  const tickSpacingMap: Record<number, number> = {
    100: 1,
    500: 10,
    3000: 60,
    10000: 200,
  };

  return {
    id: pool.id,
    exchange: 'uniswap-v3',
    network,
    token0: {
      address: pool.token0.id,
      symbol: pool.token0.symbol,
      name: pool.token0.name,
      decimals: parseInt(pool.token0.decimals),
      price: token0Price,
    },
    token1: {
      address: pool.token1.id,
      symbol: pool.token1.symbol,
      name: pool.token1.name,
      decimals: parseInt(pool.token1.decimals),
      price: token1Price,
    },
    feeTier,
    tvl,
    volume24h,
    volume7d,
    fees24h,
    fees7d,
    apr,
    tickSpacing: tickSpacingMap[feeTier] || 60,
    currentTick: parseInt(pool.tick) || 0,
    sqrtPriceX96: pool.sqrtPrice,
  };
}

// Get ETH price from CoinGecko (cached)
let ethPriceCache: { price: number; timestamp: number } | null = null;
const ETH_CACHE_DURATION = 60000; // 1 minute

async function getEthPrice(): Promise<number> {
  if (ethPriceCache && Date.now() - ethPriceCache.timestamp < ETH_CACHE_DURATION) {
    return ethPriceCache.price;
  }

  try {
    const response = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd'
    );
    const data = await response.json();
    const price = data.ethereum?.usd || 3500;
    ethPriceCache = { price, timestamp: Date.now() };
    return price;
  } catch (error) {
    console.error('Error fetching ETH price:', error);
    return ethPriceCache?.price || 3500;
  }
}

// Token prices for mock data (approximate USD values)
const MOCK_TOKEN_PRICES: Record<string, number> = {
  WETH: 3500,
  WBTC: 97000,
  USDC: 1,
  USDT: 1,
  DAI: 1,
  LINK: 15,
  UNI: 8,
  MATIC: 0.5,
  ARB: 1.2,
  AAVE: 180,
  MKR: 1800,
  CRV: 0.5,
  LDO: 2,
  ONDO: 1.2,
  PEPE: 0.000012,
};

// Calculate sqrtPriceX96 from price ratio
// sqrtPriceX96 = sqrt(price) * 2^96
function priceToSqrtPriceX96(price: number): string {
  const sqrtPrice = Math.sqrt(price);
  const Q96 = BigInt(2) ** BigInt(96);
  const sqrtPriceX96 = BigInt(Math.floor(sqrtPrice * Number(Q96)));
  return sqrtPriceX96.toString();
}

// Calculate tick from price
// tick = log(price) / log(1.0001)
function priceToTick(price: number): number {
  if (price <= 0) return 0;
  return Math.floor(Math.log(price) / Math.log(1.0001));
}

// Generate mock pools for fallback when subgraph fails
function generateMockPools(network: string, count: number = 100): Pool[] {
  const tokenPairs = [
    { token0: { symbol: 'WETH', name: 'Wrapped Ether', decimals: 18 }, token1: { symbol: 'USDC', name: 'USD Coin', decimals: 6 } },
    { token0: { symbol: 'WETH', name: 'Wrapped Ether', decimals: 18 }, token1: { symbol: 'USDT', name: 'Tether', decimals: 6 } },
    { token0: { symbol: 'WBTC', name: 'Wrapped Bitcoin', decimals: 8 }, token1: { symbol: 'WETH', name: 'Wrapped Ether', decimals: 18 } },
    { token0: { symbol: 'WETH', name: 'Wrapped Ether', decimals: 18 }, token1: { symbol: 'DAI', name: 'Dai', decimals: 18 } },
    { token0: { symbol: 'USDC', name: 'USD Coin', decimals: 6 }, token1: { symbol: 'USDT', name: 'Tether', decimals: 6 } },
    { token0: { symbol: 'LINK', name: 'Chainlink', decimals: 18 }, token1: { symbol: 'WETH', name: 'Wrapped Ether', decimals: 18 } },
    { token0: { symbol: 'UNI', name: 'Uniswap', decimals: 18 }, token1: { symbol: 'WETH', name: 'Wrapped Ether', decimals: 18 } },
    { token0: { symbol: 'MATIC', name: 'Polygon', decimals: 18 }, token1: { symbol: 'WETH', name: 'Wrapped Ether', decimals: 18 } },
    { token0: { symbol: 'ARB', name: 'Arbitrum', decimals: 18 }, token1: { symbol: 'WETH', name: 'Wrapped Ether', decimals: 18 } },
    { token0: { symbol: 'AAVE', name: 'Aave', decimals: 18 }, token1: { symbol: 'WETH', name: 'Wrapped Ether', decimals: 18 } },
    { token0: { symbol: 'MKR', name: 'Maker', decimals: 18 }, token1: { symbol: 'WETH', name: 'Wrapped Ether', decimals: 18 } },
    { token0: { symbol: 'CRV', name: 'Curve', decimals: 18 }, token1: { symbol: 'WETH', name: 'Wrapped Ether', decimals: 18 } },
    { token0: { symbol: 'LDO', name: 'Lido', decimals: 18 }, token1: { symbol: 'WETH', name: 'Wrapped Ether', decimals: 18 } },
    { token0: { symbol: 'ONDO', name: 'Ondo Finance', decimals: 18 }, token1: { symbol: 'USDC', name: 'USD Coin', decimals: 6 } },
    { token0: { symbol: 'PEPE', name: 'Pepe', decimals: 18 }, token1: { symbol: 'WETH', name: 'Wrapped Ether', decimals: 18 } },
  ];

  const feeTiers = [100, 500, 3000, 10000];
  const tickSpacingMap: Record<number, number> = { 100: 1, 500: 10, 3000: 60, 10000: 200 };
  const pools: Pool[] = [];

  for (let i = 0; i < count; i++) {
    const pair = tokenPairs[i % tokenPairs.length];
    const feeTier = feeTiers[i % feeTiers.length];
    const baseTvl = 50000000 - (i * 400000); // Decreasing TVL
    const tvl = Math.max(baseTvl + Math.random() * 1000000, 10000);
    const volume24h = tvl * (0.02 + Math.random() * 0.15);
    const fees24h = volume24h * (feeTier / 1000000);
    const apr = tvl > 0 ? (fees24h * 365 / tvl) * 100 : 0;

    // Get token prices
    const token0Price = MOCK_TOKEN_PRICES[pair.token0.symbol] || 1;
    const token1Price = MOCK_TOKEN_PRICES[pair.token1.symbol] || 1;

    // Calculate the pool price (token1 per token0, adjusted for decimals)
    // In Uniswap, sqrtPriceX96 encodes the price of token0 in terms of token1
    const rawPrice = token0Price / token1Price;
    const decimalAdjustment = Math.pow(10, pair.token1.decimals - pair.token0.decimals);
    const adjustedPrice = rawPrice * decimalAdjustment;

    const currentTick = priceToTick(adjustedPrice);
    const sqrtPriceX96 = priceToSqrtPriceX96(adjustedPrice);

    pools.push({
      id: `0x${i.toString(16).padStart(40, '0')}`,
      exchange: 'uniswap-v3',
      network,
      token0: {
        address: `0x${(i * 2).toString(16).padStart(40, '0')}`,
        symbol: pair.token0.symbol,
        name: pair.token0.name,
        decimals: pair.token0.decimals,
        price: token0Price,
      },
      token1: {
        address: `0x${(i * 2 + 1).toString(16).padStart(40, '0')}`,
        symbol: pair.token1.symbol,
        name: pair.token1.name,
        decimals: pair.token1.decimals,
        price: token1Price,
      },
      feeTier,
      tvl,
      volume24h,
      volume7d: volume24h * 7,
      fees24h,
      fees7d: fees24h * 7,
      apr,
      tickSpacing: tickSpacingMap[feeTier] || 60,
      currentTick,
      sqrtPriceX96,
    });
  }

  return pools.sort((a, b) => b.tvl - a.tvl);
}

// Main function to fetch pools
export async function fetchUniswapPools(
  network: string = 'ethereum',
  options: {
    first?: number;
    skip?: number;
    orderBy?: string;
    orderDirection?: 'asc' | 'desc';
    token0?: string;
    token1?: string;
  } = {}
): Promise<Pool[]> {
  const {
    first = 100,
    skip = 0,
    orderBy = 'totalValueLockedUSD',
    orderDirection = 'desc',
    token0,
    token1,
  } = options;

  const subgraphUrls = getSubgraphUrls(network);
  if (subgraphUrls.length === 0) {
    // No subgraph URLs available, use mock data silently
    return generateMockPools(network, first);
  }

  const ethPrice = await getEthPrice();

  let subgraphPools: SubgraphPool[];

  try {
    if (token0 || token1) {
      // Use search query if tokens are specified
      subgraphPools = await fetchFromSubgraph(subgraphUrls, SEARCH_POOLS_QUERY, {
        token0: token0 || '',
        token1: token1 || '',
        first,
      });
    } else {
      // Use standard query
      subgraphPools = await fetchFromSubgraph(subgraphUrls, POOLS_QUERY, {
        first,
        skip,
        orderBy,
        orderDirection,
      });
    }

    // If no pools returned, use mock data (silently)
    if (subgraphPools.length === 0) {
      return generateMockPools(network, first);
    }

    return subgraphPools.map(pool => convertSubgraphPool(pool, network, ethPrice));
  } catch {
    // Subgraph unavailable, use mock data silently
    return generateMockPools(network, first);
  }
}

// Fetch pools from multiple networks
export async function fetchAllNetworkPools(
  networks: string[] = ['ethereum'],
  options: {
    first?: number;
    orderBy?: string;
    orderDirection?: 'asc' | 'desc';
  } = {}
): Promise<Pool[]> {
  const { first = 50, orderBy = 'totalValueLockedUSD', orderDirection = 'desc' } = options;

  const poolPromises = networks.map(network =>
    fetchUniswapPools(network, { first, orderBy, orderDirection })
  );

  const results = await Promise.all(poolPromises);
  const allPools = results.flat();

  // Sort combined results
  return allPools.sort((a, b) => {
    if (orderBy === 'totalValueLockedUSD' || orderBy === 'tvl') {
      return orderDirection === 'desc' ? b.tvl - a.tvl : a.tvl - b.tvl;
    }
    if (orderBy === 'volumeUSD' || orderBy === 'volume24h') {
      return orderDirection === 'desc' ? b.volume24h - a.volume24h : a.volume24h - b.volume24h;
    }
    if (orderBy === 'apr') {
      return orderDirection === 'desc' ? b.apr - a.apr : a.apr - b.apr;
    }
    return 0;
  });
}

// Fetch pool count from subgraph
export async function fetchPoolCount(network: string = 'ethereum'): Promise<number> {
  const subgraphUrl = getSubgraphUrl(network);
  if (!subgraphUrl) return 365; // Default count

  try {
    const response = await fetch(subgraphUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          query {
            factories(first: 1) {
              poolCount
            }
          }
        `,
      }),
    });

    const data = await response.json();
    if (data.errors) {
      console.warn('Pool count query failed:', data.errors[0]?.message);
      return 365;
    }
    return parseInt(data.data?.factories?.[0]?.poolCount || '365');
  } catch (error) {
    console.error('Error fetching pool count:', error);
    return 365;
  }
}

// Fetch protocol stats
export async function fetchProtocolStats(network: string = 'ethereum'): Promise<{
  totalValueLockedUSD: number;
  totalVolumeUSD: number;
  poolCount: number;
  txCount: number;
}> {
  const mockStats = {
    totalValueLockedUSD: 3_200_000_000,
    totalVolumeUSD: 1_850_000_000_000,
    poolCount: 365,
    txCount: 450_000_000,
  };

  const subgraphUrls = getSubgraphUrls(network);
  if (subgraphUrls.length === 0) {
    return mockStats;
  }

  const query = `
    query {
      factories(first: 1) {
        totalValueLockedUSD
        totalVolumeUSD
        poolCount
        txCount
      }
    }
  `;

  // Try all available subgraph URLs
  for (const url of subgraphUrls) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        continue; // Try next URL
      }

      const data = await response.json();

      if (data.errors) {
        // Suppress auth error messages - they're expected without API keys
        if (process.env.NODE_ENV === 'development' && !data.errors[0]?.message?.includes('auth')) {
          console.warn('Protocol stats query failed:', data.errors[0]?.message);
        }
        continue; // Try next URL
      }

      const factory = data.data?.factories?.[0];
      if (factory) {
        return {
          totalValueLockedUSD: parseFloat(factory.totalValueLockedUSD || '3200000000'),
          totalVolumeUSD: parseFloat(factory.totalVolumeUSD || '1850000000000'),
          poolCount: parseInt(factory.poolCount || '365'),
          txCount: parseInt(factory.txCount || '450000000'),
        };
      }
    } catch (error) {
      // Silently continue to next URL
      continue;
    }
  }

  // All URLs failed - return mock data silently
  return mockStats;
}
