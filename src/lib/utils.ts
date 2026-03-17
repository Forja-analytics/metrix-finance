import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number, compact = false): string {
  if (compact) {
    if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
    if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
    if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
    if (value >= 1e3) return `$${(value / 1e3).toFixed(2)}K`;
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatNumber(value: number, decimals = 2): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatPercent(value: number, showSign = true): string {
  const sign = showSign && value > 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

export function formatCompactNumber(value: number): string {
  if (value >= 1e12) return `${(value / 1e12).toFixed(2)}T`;
  if (value >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(2)}K`;
  return value.toFixed(2);
}

export function shortenAddress(address: string, chars = 4): string {
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

export function calculateAPR(fees24h: number, tvl: number): number {
  if (tvl === 0) return 0;
  return (fees24h * 365 / tvl) * 100;
}

// Uniswap V3 tick boundaries
const MIN_TICK = -887272;
const MAX_TICK = 887272;

export function tickToPrice(tick: number, decimals0: number, decimals1: number): number {
  // Validate tick is within bounds
  if (tick < MIN_TICK || tick > MAX_TICK) {
    return 0;
  }
  const price = Math.pow(1.0001, tick) * Math.pow(10, decimals0 - decimals1);
  return isFinite(price) && price > 0 ? price : 0;
}

export function priceToTick(price: number, decimals0: number, decimals1: number): number {
  // Validate price is positive
  if (price <= 0) {
    return 0;
  }
  const adjustedPrice = price / Math.pow(10, decimals0 - decimals1);
  if (adjustedPrice <= 0) {
    return 0;
  }
  const tick = Math.floor(Math.log(adjustedPrice) / Math.log(1.0001));
  // Clamp to valid tick range
  return Math.max(MIN_TICK, Math.min(MAX_TICK, tick));
}

// Calculate price from sqrtPriceX96 (Uniswap V3 format)
// Returns the price of token0 in terms of token1
export function sqrtPriceX96ToPrice(sqrtPriceX96: string, decimals0: number, decimals1: number): number {
  // sqrtPriceX96 is a Q64.96 fixed-point number
  // price = (sqrtPriceX96 / 2^96)^2 * 10^(decimals0 - decimals1)
  // Use BigInt arithmetic to maintain precision for large values
  const Q96 = BigInt(2) ** BigInt(96);
  const sqrtPriceX96BigInt = BigInt(sqrtPriceX96);

  // Calculate (sqrtPriceX96)^2 / 2^192 with extra precision
  // We use 2^192 because we're squaring a Q96 number
  const Q192 = Q96 * Q96;
  const priceX192 = sqrtPriceX96BigInt * sqrtPriceX96BigInt;

  // Scale to maintain precision: multiply by 10^18 before dividing
  const PRECISION = BigInt(10) ** BigInt(18);
  const scaledPrice = (priceX192 * PRECISION) / Q192;

  // Convert to number and adjust for decimals
  const price = Number(scaledPrice) / Number(PRECISION);

  // Adjust for token decimal difference
  return price * Math.pow(10, decimals0 - decimals1);
}

// Get the pool price using the most accurate available method
export function getPoolPrice(
  sqrtPriceX96: string | undefined,
  currentTick: number | undefined,
  token0Decimals: number,
  token1Decimals: number,
  token0UsdPrice?: number,
  token1UsdPrice?: number
): number {
  // Method 1: Use sqrtPriceX96 (most accurate)
  if (sqrtPriceX96 && sqrtPriceX96 !== '0') {
    try {
      const price = sqrtPriceX96ToPrice(sqrtPriceX96, token0Decimals, token1Decimals);
      if (price > 0 && isFinite(price)) {
        return price;
      }
    } catch {
      // Fall through to next method
    }
  }

  // Method 2: Use currentTick (tick 0 is valid - represents price ratio of 1.0)
  if (currentTick !== undefined) {
    const price = tickToPrice(currentTick, token0Decimals, token1Decimals);
    if (price > 0 && isFinite(price)) {
      return price;
    }
  }

  // Method 3: Fallback to USD price ratio
  if (token0UsdPrice && token1UsdPrice && token1UsdPrice > 0) {
    return token0UsdPrice / token1UsdPrice;
  }

  return 0;
}

export function calculateImpermanentLoss(
  priceRatio: number
): number {
  const sqrtRatio = Math.sqrt(priceRatio);
  return 2 * sqrtRatio / (1 + priceRatio) - 1;
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Calculate token amounts for concentrated liquidity based on price position in range
// Uses Uniswap V3 concentrated liquidity math
export function calculateTokenAmounts(
  deposit: number,
  currentPrice: number,
  lowerPrice: number,
  upperPrice: number,
  token0Price: number,
  token1Price: number
): { token0Amount: number; token1Amount: number } {
  // Input validation
  if (deposit <= 0 || currentPrice <= 0 || lowerPrice <= 0 || upperPrice <= 0) {
    return { token0Amount: 0, token1Amount: 0 };
  }
  if (lowerPrice >= upperPrice) {
    return { token0Amount: 0, token1Amount: 0 };
  }
  if (token0Price <= 0 || token1Price <= 0) {
    return { token0Amount: 0, token1Amount: 0 };
  }

  const sqrtPriceCurrent = Math.sqrt(currentPrice);
  const sqrtPriceLower = Math.sqrt(lowerPrice);
  const sqrtPriceUpper = Math.sqrt(upperPrice);

  if (currentPrice <= lowerPrice) {
    // Below range - 100% token0
    return {
      token0Amount: deposit / token0Price,
      token1Amount: 0,
    };
  } else if (currentPrice >= upperPrice) {
    // Above range - 100% token1
    return {
      token0Amount: 0,
      token1Amount: deposit / token1Price,
    };
  } else {
    // In range - use correct Uniswap V3 formulas
    // For a given liquidity L:
    //   amount0 = L * (1/sqrt(Pc) - 1/sqrt(Pb)) = L * (sqrt(Pb) - sqrt(Pc)) / (sqrt(Pc) * sqrt(Pb))
    //   amount1 = L * (sqrt(Pc) - sqrt(Pa))
    // We need to find L such that value0 + value1 = deposit

    // Calculate the ratio factors (without L)
    const amount0Factor = (sqrtPriceUpper - sqrtPriceCurrent) / (sqrtPriceCurrent * sqrtPriceUpper);
    const amount1Factor = sqrtPriceCurrent - sqrtPriceLower;

    // Value per unit liquidity (in USD terms)
    // amount0 * token0Price + amount1 * token1Price = L * (amount0Factor * token0Price + amount1Factor * token1Price)
    const valuePerLiquidity = amount0Factor * token0Price + amount1Factor * token1Price;

    if (valuePerLiquidity <= 0) {
      return { token0Amount: 0, token1Amount: 0 };
    }

    // Calculate liquidity from deposit
    const liquidity = deposit / valuePerLiquidity;

    // Calculate actual token amounts
    const token0Amount = liquidity * amount0Factor;
    const token1Amount = liquidity * amount1Factor;

    return {
      token0Amount,
      token1Amount,
    };
  }
}

// Calculate concentration factor for Uniswap V3
// This represents how much more capital efficient a concentrated position is vs full range
export function calculateConcentrationFactor(
  currentPrice: number,
  lowerPrice: number,
  upperPrice: number
): number {
  // Input validation
  if (currentPrice <= 0 || lowerPrice <= 0 || upperPrice <= 0) {
    return 1;
  }
  if (lowerPrice >= upperPrice) {
    return 1;
  }

  const sqrtPriceLower = Math.sqrt(lowerPrice);
  const sqrtPriceUpper = Math.sqrt(upperPrice);
  const sqrtPriceCurrent = Math.sqrt(currentPrice);

  // For concentrated liquidity, capital efficiency = 1 / (1 - sqrt(Pa/Pb))
  // This formula gives the multiplier for how much less capital is needed
  // for the same liquidity compared to full range
  const sqrtPriceRatio = sqrtPriceLower / sqrtPriceUpper;

  // Avoid division by zero for very narrow ranges
  if (sqrtPriceRatio >= 0.9999) {
    return 1000; // Cap for extremely narrow ranges
  }

  // The concentration factor represents capital efficiency improvement
  // Formula: 1 / (1 - sqrt(priceLower/priceUpper))
  const concentrationFactor = 1 / (1 - sqrtPriceRatio);

  // Cap at reasonable maximum (extremely narrow ranges would give unrealistic values)
  return Math.min(concentrationFactor, 1000);
}

// Estimate time in range using log-normal distribution
// For log-normal price movements, calculates probability of price staying within [lowerPrice, upperPrice]
export function calculateTimeInRange(
  currentPrice: number,
  lowerPrice: number,
  upperPrice: number,
  days: number,
  annualVolatility = 0.5
): number {
  // Input validation
  if (currentPrice <= 0 || lowerPrice <= 0 || upperPrice <= 0 || days <= 0) {
    return 0.5;
  }
  if (lowerPrice >= upperPrice) {
    return 0;
  }

  // Standard deviation of log returns over the period
  const sigma = annualVolatility * Math.sqrt(days / 365);

  // For log-normal distribution, the log price is normally distributed
  // Log(P_t/P_0) ~ N(-sigma^2/2, sigma^2) under risk-neutral measure
  // Using real-world measure with zero drift for simplicity
  const drift = -0.5 * sigma * sigma; // Drift adjustment for log-normal

  // Calculate z-scores for boundaries
  const zLower = (Math.log(lowerPrice / currentPrice) - drift) / sigma;
  const zUpper = (Math.log(upperPrice / currentPrice) - drift) / sigma;

  // Error function approximation (Abramowitz and Stegun)
  const erf = (x: number): number => {
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;
    const sign = x < 0 ? -1 : 1;
    const absX = Math.abs(x);
    const t = 1.0 / (1.0 + p * absX);
    const y = 1.0 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX);
    return sign * y;
  };

  const normalCDF = (x: number): number => 0.5 * (1 + erf(x / Math.sqrt(2)));

  // Probability of price being in range = P(lower < P_t < upper) = CDF(zUpper) - CDF(zLower)
  const probInRange = normalCDF(zUpper) - normalCDF(zLower);

  // Clamp to reasonable bounds
  return Math.max(0.05, Math.min(0.95, probInRange));
}

// Calculate expected impermanent loss for concentrated liquidity position
// Considers probability-weighted outcomes across the price range
export function calculateExpectedIL(
  currentPrice: number,
  lowerPrice: number,
  upperPrice: number,
  annualVolatility = 0.5
): number {
  // Input validation
  if (currentPrice <= 0 || lowerPrice <= 0 || upperPrice <= 0) {
    return 0;
  }
  if (lowerPrice >= upperPrice) {
    return 0;
  }

  // Calculate IL at key price points
  const ilAtLower = Math.abs(calculateImpermanentLoss(lowerPrice / currentPrice));
  const ilAtUpper = Math.abs(calculateImpermanentLoss(upperPrice / currentPrice));
  const ilAtMidLower = Math.abs(calculateImpermanentLoss((lowerPrice + currentPrice) / 2 / currentPrice));
  const ilAtMidUpper = Math.abs(calculateImpermanentLoss((upperPrice + currentPrice) / 2 / currentPrice));

  // Use Simpson's rule for better approximation of expected IL
  // Weight: edges get less weight since they're less likely when starting in middle
  const rangeWidth = Math.log(upperPrice / lowerPrice);
  const volatilityFactor = Math.min(annualVolatility, 1.0);

  // Probability of reaching boundaries increases with volatility and range width
  const boundaryProb = Math.min(0.4, volatilityFactor * 0.5);
  const middleProb = 1 - 2 * boundaryProb;

  // Weighted average IL (using trapezoidal approximation)
  const expectedIL =
    boundaryProb * ilAtLower +
    middleProb * 0.5 * (ilAtMidLower + ilAtMidUpper) +
    boundaryProb * ilAtUpper;

  // Scale by probability of actually moving significantly within the range
  // Wider ranges have less expected IL as price is less likely to hit boundaries
  const rangeScaling = Math.min(1, rangeWidth * volatilityFactor);

  return expectedIL * rangeScaling;
}

export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

// ============================================================
// Liquidity Distribution Calculation
// ============================================================

import type { TickData, PoolDayData, LiquidityBin, SimulationPoolStats } from '@/types';

export function calculateLiquidityDistribution(
  ticks: TickData[],
  currentTick: number,
  tickSpacing: number,
  token0Decimals: number,
  token1Decimals: number,
  lowerTick?: number,
  upperTick?: number,
  numBins: number = 100
): LiquidityBin[] {
  if (ticks.length === 0) return [];

  // Sort ticks and accumulate active liquidity
  const sortedTicks = [...ticks].sort((a, b) => a.tickIdx - b.tickIdx);

  // Find the range to display (centered around current tick)
  const tickRange = Math.max(
    Math.abs(sortedTicks[sortedTicks.length - 1].tickIdx - sortedTicks[0].tickIdx),
    tickSpacing * 200
  );
  const displayMin = currentTick - tickRange / 2;
  const displayMax = currentTick + tickRange / 2;
  const binWidth = (displayMax - displayMin) / numBins;

  // Build cumulative liquidity by walking through ticks
  let cumulativeLiquidity = BigInt(0);
  const tickLiquidityMap = new Map<number, bigint>();

  for (const tick of sortedTicks) {
    cumulativeLiquidity += BigInt(tick.liquidityNet);
    tickLiquidityMap.set(tick.tickIdx, cumulativeLiquidity);
  }

  // Create bins
  const bins: LiquidityBin[] = [];
  for (let i = 0; i < numBins; i++) {
    const binTickLow = displayMin + i * binWidth;
    const binTickHigh = binTickLow + binWidth;
    const binTickMid = (binTickLow + binTickHigh) / 2;

    // Find liquidity at this tick (closest tick below)
    let liquidity = BigInt(0);
    for (const tick of sortedTicks) {
      if (tick.tickIdx <= binTickMid) {
        liquidity = tickLiquidityMap.get(tick.tickIdx) || BigInt(0);
      } else break;
    }

    const price0 = tickToPrice(Math.round(binTickLow), token0Decimals, token1Decimals);
    const price1 = tickToPrice(Math.round(binTickHigh), token0Decimals, token1Decimals);
    const isCurrent = currentTick >= binTickLow && currentTick < binTickHigh;
    const isInRange = lowerTick !== undefined && upperTick !== undefined
      ? binTickMid >= lowerTick && binTickMid <= upperTick
      : false;

    bins.push({
      price0,
      price1,
      liquidity: Number(liquidity < 0 ? -liquidity : liquidity),
      isCurrent,
      isInRange,
    });
  }

  return bins;
}

// ============================================================
// Pool Statistics Calculation
// ============================================================

export function calculatePoolStats(dayData: PoolDayData[], tvl: number): SimulationPoolStats {
  if (dayData.length < 2) {
    return {
      priceVolatility: 0,
      avgDailyFees: 0,
      dailyFeesToTvl: 0,
      avgDailyVolume: 0,
      dailyVolumeToTvl: 0,
      correlation: 0,
      geometricMean: 0,
    };
  }

  // Daily returns for volatility
  const returns: number[] = [];
  const prices: number[] = [];
  const volumes: number[] = [];
  const fees: number[] = [];

  for (let i = 0; i < dayData.length; i++) {
    prices.push(dayData[i].close);
    volumes.push(dayData[i].volumeUSD);
    fees.push(dayData[i].feesUSD);
    if (i > 0 && dayData[i - 1].close > 0) {
      returns.push(Math.log(dayData[i].close / dayData[i - 1].close));
    }
  }

  // Price volatility (annualized std dev of daily log returns)
  const meanReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + (r - meanReturn) ** 2, 0) / returns.length;
  const dailyVol = Math.sqrt(variance);
  const priceVolatility = dailyVol * Math.sqrt(365) * 100;

  // Averages
  const avgDailyFees = fees.reduce((a, b) => a + b, 0) / fees.length;
  const avgDailyVolume = volumes.reduce((a, b) => a + b, 0) / volumes.length;
  const safeTvl = Math.max(tvl, 1);

  // Correlation between price and volume
  const meanPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
  const meanVolume = avgDailyVolume;
  let covPV = 0, varP = 0, varV = 0;
  for (let i = 0; i < prices.length; i++) {
    const dp = prices[i] - meanPrice;
    const dv = volumes[i] - meanVolume;
    covPV += dp * dv;
    varP += dp * dp;
    varV += dv * dv;
  }
  const correlation = (varP > 0 && varV > 0) ? covPV / Math.sqrt(varP * varV) : 0;

  // Geometric mean of prices
  const logSum = prices.filter(p => p > 0).reduce((sum, p) => sum + Math.log(p), 0);
  const geometricMean = Math.exp(logSum / prices.length);

  return {
    priceVolatility,
    avgDailyFees,
    dailyFeesToTvl: (avgDailyFees / safeTvl) * 100,
    avgDailyVolume,
    dailyVolumeToTvl: (avgDailyVolume / safeTvl) * 100,
    correlation,
    geometricMean,
  };
}

export function nearestUsableTick(tick: number, tickSpacing: number): number {
  return Math.round(tick / tickSpacing) * tickSpacing;
}
