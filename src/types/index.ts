export interface MarketData {
  defiMarketCap: number;
  defiMarketCapChange: number;
  cryptoMarketCap: number;
  cryptoMarketCapChange: number;
  defiVolume24h: number;
  defiVolumeChange: number;
  cryptoVolume24h: number;
  cryptoVolumeChange: number;
  fearGreedIndex: number;
  fearGreedLabel: string;
  altcoinSeasonIndex: number;
}

export interface Pool {
  id: string;
  exchange: string;
  network: string;
  token0: Token;
  token1: Token;
  feeTier: number;
  tvl: number;
  volume24h: number;
  volume7d: number;
  fees24h: number;
  fees7d: number;
  apr: number;
  tickSpacing: number;
  currentTick: number;
  sqrtPriceX96: string;
}

export interface Token {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
  price?: number;
}

export interface Position {
  id: string;
  pool: Pool;
  tickLower: number;
  tickUpper: number;
  liquidity: string;
  token0Amount: number;
  token1Amount: number;
  uncollectedFees0: number;
  uncollectedFees1: number;
  depositedToken0: number;
  depositedToken1: number;
  depositedUSD: number;
  currentValueUSD: number;
  pnl: number;
  pnlPercentage: number;
  feesEarnedUSD: number;
  createdAt: string;
}

export interface SimulationParams {
  pool: Pool | null;
  depositAmount: number;
  priceRangeLower: number;
  priceRangeUpper: number;
  daysToSimulate: number;
}

export interface SimulationResult {
  estimatedFees: number;
  estimatedAPR: number;
  impermanentLoss: number;
  netReturn: number;
  token0Amount: number;
  token1Amount: number;
  inRange: boolean;
  timeInRange: number;
  dailyFees: number[];
}

export interface Exchange {
  id: string;
  name: string;
  logo: string;
  networks: Network[];
}

export interface Network {
  id: string;
  name: string;
  chainId: number;
  logo: string;
}

export type SortDirection = 'asc' | 'desc';
export type PoolSortField = 'tvl' | 'volume24h' | 'fees24h' | 'apr';

// Pool tick data for liquidity distribution charts
export interface TickData {
  tickIdx: number;
  liquidityGross: string;
  liquidityNet: string;
}

// Pool historical day data for price/volume charts
export interface PoolDayData {
  date: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volumeUSD: number;
  feesUSD: number;
  tvlUSD: number;
}

// Computed pool statistics for simulation
export interface SimulationPoolStats {
  priceVolatility: number;
  avgDailyFees: number;
  dailyFeesToTvl: number;
  avgDailyVolume: number;
  dailyVolumeToTvl: number;
  correlation: number;
  geometricMean: number;
}

// Liquidity distribution bin for charts
export interface LiquidityBin {
  price0: number;
  price1: number;
  liquidity: number;
  isCurrent: boolean;
  isInRange: boolean;
}

// Language
export type Language = 'en' | 'es' | 'pt' | 'fr' | 'de';
