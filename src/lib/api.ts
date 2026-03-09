import { MarketData, Pool, Token } from '@/types';

// CoinGecko API - Free tier (no API key required, but rate limited)
const COINGECKO_API = 'https://api.coingecko.com/api/v3';

// DeFi Llama API - Free, no rate limits
const DEFILLAMA_API = 'https://api.llama.fi';

// Alternative.me Fear & Greed API - Free
const FEAR_GREED_API = 'https://api.alternative.me/fng';

// Token price cache to avoid excessive API calls
let priceCache: { prices: Record<string, number>; timestamp: number } | null = null;
const CACHE_DURATION = 60000; // 1 minute

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

// Default fallback prices (updated periodically as reasonable estimates)
const FALLBACK_PRICES: Record<string, number> = {
  ETH: 3500,
  WETH: 3500,
  BTC: 97000,
  WBTC: 97000,
  USDC: 1,
  USDT: 1,
  DAI: 1,
  LINK: 25,
  UNI: 14,
  MATIC: 0.5,
  ARB: 1,
  ONDO: 1.5,
};

// Fetch token prices from CoinGecko
export async function fetchTokenPrices(): Promise<Record<string, number>> {
  // Check cache
  if (priceCache && Date.now() - priceCache.timestamp < CACHE_DURATION) {
    return priceCache.prices;
  }

  try {
    const ids = 'ethereum,bitcoin,usd-coin,tether,wrapped-bitcoin,dai,chainlink,uniswap,matic-network,arbitrum,ondo-finance';
    // Use proxy API route to avoid CORS issues
    const apiUrl = typeof window !== 'undefined'
      ? `/api/proxy/coingecko?ids=${ids}&vs_currencies=usd&include_24hr_change=true`
      : `${COINGECKO_API}/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`;

    const response = await fetchWithTimeout(apiUrl, 10000);

    if (!response.ok) {
      console.log('[CoinGecko] API returned error status:', response.status);
      return priceCache?.prices || FALLBACK_PRICES;
    }

    const data = await response.json();

    const prices: Record<string, number> = {
      ETH: data.ethereum?.usd || 0,
      WETH: data.ethereum?.usd || 0,
      BTC: data.bitcoin?.usd || 0,
      WBTC: data['wrapped-bitcoin']?.usd || 0,
      USDC: data['usd-coin']?.usd || 1,
      USDT: data.tether?.usd || 1,
      DAI: data.dai?.usd || 1,
      LINK: data.chainlink?.usd || 0,
      UNI: data.uniswap?.usd || 0,
      MATIC: data['matic-network']?.usd || 0,
      ARB: data.arbitrum?.usd || 0,
      ONDO: data['ondo-finance']?.usd || 0,
    };

    priceCache = { prices, timestamp: Date.now() };
    return prices;
  } catch (error: unknown) {
    // Handle timeout and network errors gracefully
    if (error instanceof Error && error.name === 'AbortError') {
      console.log('[CoinGecko] Request timed out, using cached/fallback prices');
    } else {
      console.log('[CoinGecko] Fetch error:', error instanceof Error ? error.message : 'Unknown error');
    }
    // Return cached prices if available, otherwise fallback
    return priceCache?.prices || FALLBACK_PRICES;
  }
}

// Fetch market data from multiple APIs
export async function fetchMarketData(): Promise<MarketData> {
  try {
    // Fetch data in parallel
    const [globalData, defiData, fearGreedData] = await Promise.all([
      fetchCryptoGlobalData(),
      fetchDefiGlobalData(),
      fetchFearGreedIndex(),
    ]);

    return {
      defiMarketCap: defiData.totalLiquidity || 0,
      defiMarketCapChange: defiData.change24h || 0,
      cryptoMarketCap: globalData.totalMarketCap || 0,
      cryptoMarketCapChange: globalData.marketCapChange24h || 0,
      defiVolume24h: defiData.volume24h || 0,
      defiVolumeChange: 0,
      cryptoVolume24h: globalData.volume24h || 0,
      cryptoVolumeChange: 0,
      fearGreedIndex: fearGreedData.value,
      fearGreedLabel: fearGreedData.label,
      altcoinSeasonIndex: calculateAltcoinSeasonIndex(globalData.btcDominance || 50),
    };
  } catch (error) {
    console.error('Error fetching market data:', error);
    // Return fallback data
    return {
      defiMarketCap: 89_500_000_000,
      defiMarketCapChange: 2.34,
      cryptoMarketCap: 3_450_000_000_000,
      cryptoMarketCapChange: 1.82,
      defiVolume24h: 4_200_000_000,
      defiVolumeChange: -5.21,
      cryptoVolume24h: 78_000_000_000,
      cryptoVolumeChange: 3.45,
      fearGreedIndex: 65,
      fearGreedLabel: 'Greed',
      altcoinSeasonIndex: 42,
    };
  }
}

// Fetch global crypto market data from CoinGecko
async function fetchCryptoGlobalData() {
  try {
    const response = await fetch(`${COINGECKO_API}/global`);
    if (!response.ok) throw new Error('Failed to fetch global data');
    const data = await response.json();

    return {
      totalMarketCap: data.data?.total_market_cap?.usd || 0,
      marketCapChange24h: data.data?.market_cap_change_percentage_24h_usd || 0,
      volume24h: data.data?.total_volume?.usd || 0,
      btcDominance: data.data?.market_cap_percentage?.btc || 50,
    };
  } catch (error) {
    console.error('Error fetching global crypto data:', error);
    return {
      totalMarketCap: 3_450_000_000_000,
      marketCapChange24h: 1.82,
      volume24h: 78_000_000_000,
      btcDominance: 52,
    };
  }
}

// Fetch DeFi data from DeFi Llama
async function fetchDefiGlobalData() {
  try {
    const response = await fetch(`${DEFILLAMA_API}/v2/historicalChainTvl`);
    if (!response.ok) throw new Error('Failed to fetch DeFi data');
    const data = await response.json();

    // Get the latest TVL
    const latest = data[data.length - 1];
    const previous = data[data.length - 2];
    const change24h = previous?.tvl ? ((latest.tvl - previous.tvl) / previous.tvl) * 100 : 0;

    return {
      totalLiquidity: latest?.tvl || 0,
      change24h: change24h,
      volume24h: 4_200_000_000, // DeFi Llama doesn't provide volume directly
    };
  } catch (error) {
    console.error('Error fetching DeFi data:', error);
    return {
      totalLiquidity: 89_500_000_000,
      change24h: 2.34,
      volume24h: 4_200_000_000,
    };
  }
}

// Fetch Fear & Greed Index
export async function fetchFearGreedIndex(): Promise<{ value: number; label: string }> {
  try {
    const response = await fetch(`${FEAR_GREED_API}/?limit=1`);
    if (!response.ok) throw new Error('Failed to fetch Fear & Greed');
    const data = await response.json();

    const value = parseInt(data.data?.[0]?.value || '50', 10);
    const classification = data.data?.[0]?.value_classification || 'Neutral';

    return {
      value,
      label: classification,
    };
  } catch (error) {
    console.error('Error fetching Fear & Greed:', error);
    return { value: 50, label: 'Neutral' };
  }
}

// Calculate Altcoin Season Index (inverse of BTC dominance)
function calculateAltcoinSeasonIndex(btcDominance: number): number {
  // Higher BTC dominance = lower altcoin season index
  // BTC dominance of 60%+ = Bitcoin Season (index < 25)
  // BTC dominance of 40% or less = Altcoin Season (index > 75)
  return Math.max(0, Math.min(100, 100 - btcDominance));
}

// Fetch pools with real data from Uniswap subgraph
export async function fetchPools(
  exchange: string,
  network: string,
  token0?: string,
  token1?: string,
  options?: {
    first?: number;
    orderBy?: string;
    orderDirection?: 'asc' | 'desc';
  }
): Promise<Pool[]> {
  // Import dynamically to avoid circular dependencies
  const { fetchUniswapPools } = await import('./uniswap-subgraph');

  // Only support Uniswap V3 for now
  if (exchange !== 'uniswap-v3' && exchange !== 'uniswap') {
    console.log(`Exchange ${exchange} not supported yet, defaulting to uniswap-v3`);
  }

  try {
    const pools = await fetchUniswapPools(network, {
      first: options?.first || 100,
      orderBy: options?.orderBy || 'totalValueLockedUSD',
      orderDirection: options?.orderDirection || 'desc',
      token0,
      token1,
    });

    // Additional filtering if tokens specified
    if (token0 || token1) {
      return pools.filter(pool => {
        if (token0 && token1) {
          const symbols = [pool.token0.symbol.toUpperCase(), pool.token1.symbol.toUpperCase()];
          return symbols.includes(token0.toUpperCase()) && symbols.includes(token1.toUpperCase());
        }
        if (token0) {
          return pool.token0.symbol.toUpperCase().includes(token0.toUpperCase()) ||
                 pool.token1.symbol.toUpperCase().includes(token0.toUpperCase());
        }
        if (token1) {
          return pool.token0.symbol.toUpperCase().includes(token1.toUpperCase()) ||
                 pool.token1.symbol.toUpperCase().includes(token1.toUpperCase());
        }
        return true;
      });
    }

    return pools;
  } catch (error) {
    console.error('Error fetching pools from subgraph:', error);
    // Return empty array on error
    return [];
  }
}

export async function fetchPoolById(poolId: string): Promise<Pool | null> {
  const pools = await fetchPools('uniswap-v3', 'ethereum');
  return pools.find((p) => p.id === poolId) || null;
}

export async function searchTokens(query: string): Promise<Token[]> {
  const prices = await fetchTokenPrices();

  const allTokens: Token[] = [
    { address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', symbol: 'ETH', name: 'Ethereum', decimals: 18, price: prices.ETH },
    { address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', symbol: 'USDC', name: 'USD Coin', decimals: 6, price: prices.USDC },
    { address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', symbol: 'USDT', name: 'Tether', decimals: 6, price: prices.USDT },
    { address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', symbol: 'WBTC', name: 'Wrapped Bitcoin', decimals: 8, price: prices.WBTC },
    { address: '0x6B175474E89094C44Da98b954EesNcdBC2aFd3db', symbol: 'DAI', name: 'Dai', decimals: 18, price: prices.DAI },
    { address: '0x514910771AF9Ca656af840dff83E8264EcF986CA', symbol: 'LINK', name: 'Chainlink', decimals: 18, price: prices.LINK },
    { address: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984', symbol: 'UNI', name: 'Uniswap', decimals: 18, price: prices.UNI },
  ];

  if (!query) return allTokens;

  const lowerQuery = query.toLowerCase();
  return allTokens.filter(
    (token) =>
      token.symbol.toLowerCase().includes(lowerQuery) ||
      token.name.toLowerCase().includes(lowerQuery)
  );
}

// Fetch DeFi TVL from DeFi Llama
export async function fetchDefiTVL(): Promise<number> {
  try {
    const response = await fetch(`${DEFILLAMA_API}/v2/historicalChainTvl`);
    if (!response.ok) throw new Error('Failed to fetch TVL');
    const data = await response.json();
    return data[data.length - 1]?.tvl || 0;
  } catch (error) {
    console.error('Error fetching DeFi TVL:', error);
    return 89_500_000_000;
  }
}

// Fetch specific protocol TVL
export async function fetchProtocolTVL(protocol: string): Promise<number> {
  try {
    const response = await fetch(`${DEFILLAMA_API}/tvl/${protocol}`);
    if (!response.ok) throw new Error('Failed to fetch protocol TVL');
    const tvl = await response.json();
    return tvl || 0;
  } catch (error) {
    console.error('Error fetching protocol TVL:', error);
    return 0;
  }
}
