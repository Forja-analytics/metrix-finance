'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { TokenPairIcon, TokenIcon } from '@/components/ui/TokenIcon';
import { Pool, PoolDayData, TickData, LiquidityBin } from '@/types';
import {
  formatCurrency,
  formatPercent,
  formatNumber,
  formatCompactNumber,
  shortenAddress,
  getPoolPrice,
  calculateTokenAmounts,
  calculateConcentrationFactor,
  calculateTimeInRange,
  calculateExpectedIL,
  calculateLiquidityDistribution,
  calculatePoolStats,
  priceToTick,
  tickToPrice,
  nearestUsableTick,
  cn,
} from '@/lib/utils';
import { fetchPoolTicks, fetchPoolDayData } from '@/lib/uniswap-subgraph';
import LiquidityDistributionChart from './charts/LiquidityDistributionChart';
import PoolPriceChart from './charts/PoolPriceChart';
import VolumeHistoryChart from './charts/VolumeHistoryChart';
import PositionBreakdownChart from './charts/PositionBreakdownChart';
import {
  ArrowLeftRight,
  Copy,
  ExternalLink,
  Bookmark,
  Share2,
  Star,
  Minus,
  Plus,
  ChevronDown,
  RefreshCw,
} from 'lucide-react';

interface SimulationViewProps {
  pool: Pool;
  onChangePool: () => void;
}

export function SimulationView({ pool, onChangePool }: SimulationViewProps) {
  // === STATE ===
  const [depositAmount, setDepositAmount] = useState<string>('8000');
  const [lowerPriceStr, setLowerPriceStr] = useState<string>('');
  const [upperPriceStr, setUpperPriceStr] = useState<string>('');
  const [priceMode, setPriceMode] = useState<'token' | 'usd'>('usd');
  const [calculationDays, setCalculationDays] = useState(14);
  const [calculationMethod, setCalculationMethod] = useState<'average' | 'geometric'>('average');
  const [fullRange, setFullRange] = useState(false);
  const [copied, setCopied] = useState(false);

  // Data
  const [ticks, setTicks] = useState<TickData[]>([]);
  const [dayData, setDayData] = useState<PoolDayData[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);

  // === DERIVED VALUES ===
  const currentPrice = useMemo(() => {
    return getPoolPrice(
      pool.sqrtPriceX96,
      pool.currentTick,
      pool.token0.decimals,
      pool.token1.decimals,
      pool.token0.price,
      pool.token1.price
    );
  }, [pool]);

  const token0Price = pool.token0.price || 1;
  const token1Price = pool.token1.price || 1;

  // Convert pool price (token1/token0) to USD price of token0
  const poolPriceToUsd = useCallback((poolPrice: number) => poolPrice * token1Price, [token1Price]);
  const usdToPoolPrice = useCallback((usdPrice: number) => usdPrice / token1Price, [token1Price]);

  // Parse prices (always convert to pool price internally)
  const lowerPrice = useMemo(() => {
    const val = parseFloat(lowerPriceStr);
    if (!val || isNaN(val)) return 0;
    return priceMode === 'usd' ? usdToPoolPrice(val) : val;
  }, [lowerPriceStr, priceMode, usdToPoolPrice]);

  const upperPrice = useMemo(() => {
    const val = parseFloat(upperPriceStr);
    if (!val || isNaN(val)) return 0;
    return priceMode === 'usd' ? usdToPoolPrice(val) : val;
  }, [upperPriceStr, priceMode, usdToPoolPrice]);

  // Price change percentages
  const lowerPctChange = currentPrice > 0 && lowerPrice > 0
    ? ((lowerPrice - currentPrice) / currentPrice) * 100
    : 0;
  const upperPctChange = currentPrice > 0 && upperPrice > 0
    ? ((upperPrice - currentPrice) / currentPrice) * 100
    : 0;

  // Convert display value
  const getEquivalentDisplay = useCallback((valueStr: string) => {
    const val = parseFloat(valueStr);
    if (!val || isNaN(val)) return '';
    if (priceMode === 'usd') {
      // Show pool price equivalent
      const poolPrice = usdToPoolPrice(val);
      return poolPrice >= 1 ? formatNumber(poolPrice, 4) : poolPrice.toPrecision(6);
    } else {
      // Show USD equivalent
      const usdVal = poolPriceToUsd(val);
      return `$${formatNumber(usdVal, usdVal >= 100 ? 2 : 4)}`;
    }
  }, [priceMode, poolPriceToUsd, usdToPoolPrice]);

  // Set default prices when pool changes
  useEffect(() => {
    if (currentPrice > 0) {
      const lower = currentPrice * 0.85;
      const upper = currentPrice * 1.1;
      if (priceMode === 'usd') {
        setLowerPriceStr(poolPriceToUsd(lower).toFixed(2));
        setUpperPriceStr(poolPriceToUsd(upper).toFixed(2));
      } else {
        const dec = lower >= 1 ? 4 : 8;
        setLowerPriceStr(lower.toFixed(dec));
        setUpperPriceStr(upper.toFixed(dec));
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pool.id]);

  // Fetch tick data and day data
  useEffect(() => {
    setIsLoadingData(true);
    const network = pool.network || 'ethereum';
    Promise.all([
      fetchPoolTicks(pool.id, network),
      fetchPoolDayData(pool.id, network, 30),
    ]).then(([tickData, poolDayData]) => {
      setTicks(tickData);
      setDayData(poolDayData);
      setIsLoadingData(false);
    });
  }, [pool.id, pool.network]);

  // === CALCULATIONS ===
  const deposit = parseFloat(depositAmount) || 0;

  const tokenAmounts = useMemo(() => {
    if (deposit <= 0 || lowerPrice <= 0 || upperPrice <= 0 || lowerPrice >= upperPrice) {
      return { token0Amount: 0, token1Amount: 0 };
    }
    return calculateTokenAmounts(deposit, currentPrice, lowerPrice, upperPrice, token0Price, token1Price);
  }, [deposit, currentPrice, lowerPrice, upperPrice, token0Price, token1Price]);

  const token0ValueUSD = tokenAmounts.token0Amount * token0Price;
  const token1ValueUSD = tokenAmounts.token1Amount * token1Price;
  const totalTokenValue = token0ValueUSD + token1ValueUSD;
  const token0Pct = totalTokenValue > 0 ? (token0ValueUSD / totalTokenValue) * 100 : 50;
  const token1Pct = totalTokenValue > 0 ? (token1ValueUSD / totalTokenValue) * 100 : 50;

  // Fee estimation
  const feeEstimation = useMemo(() => {
    if (deposit <= 0 || lowerPrice <= 0 || upperPrice <= 0 || lowerPrice >= upperPrice) {
      return { fees24h: 0, monthlyPct: 0, yearlyAPR: 0, fees24hUSD: 0, monthlyUSD: 0 };
    }
    const concentrationFactor = calculateConcentrationFactor(currentPrice, lowerPrice, upperPrice);
    const estimatedVolatility = pool.volume24h > 0 && pool.tvl > 0
      ? Math.min(1.0, (pool.volume24h / pool.tvl) * 365 * 0.5)
      : 0.5;
    const timeInRange = calculateTimeInRange(currentPrice, lowerPrice, upperPrice, 30, estimatedVolatility);
    const dailyRate = pool.apr / 365 / 100;
    const effectiveConcentration = Math.min(concentrationFactor, 20);
    const fees24h = deposit * dailyRate * effectiveConcentration * timeInRange;
    const monthlyFees = fees24h * 30;
    const yearlyAPR = deposit > 0 ? (fees24h * 365 / deposit) * 100 : 0;
    const monthlyPct = yearlyAPR / 12;

    return {
      fees24h,
      monthlyPct,
      yearlyAPR,
      fees24hUSD: fees24h,
      monthlyUSD: monthlyFees,
    };
  }, [deposit, currentPrice, lowerPrice, upperPrice, pool.apr, pool.volume24h, pool.tvl]);

  // Liquidity distribution bins
  const liquidityBins = useMemo(() => {
    if (ticks.length === 0) return [];
    const lowerTick = lowerPrice > 0 ? priceToTick(lowerPrice, pool.token0.decimals, pool.token1.decimals) : undefined;
    const upperTick = upperPrice > 0 ? priceToTick(upperPrice, pool.token0.decimals, pool.token1.decimals) : undefined;
    return calculateLiquidityDistribution(
      ticks, pool.currentTick, pool.tickSpacing,
      pool.token0.decimals, pool.token1.decimals,
      lowerTick, upperTick
    );
  }, [ticks, pool, lowerPrice, upperPrice]);

  // Pool stats
  const poolStats = useMemo(() => {
    return calculatePoolStats(dayData, pool.tvl);
  }, [dayData, pool.tvl]);

  // Ticks in range
  const ticksInRange = useMemo(() => {
    if (lowerPrice <= 0 || upperPrice <= 0) return 0;
    const lTick = priceToTick(lowerPrice, pool.token0.decimals, pool.token1.decimals);
    const uTick = priceToTick(upperPrice, pool.token0.decimals, pool.token1.decimals);
    return Math.abs(Math.floor((uTick - lTick) / pool.tickSpacing));
  }, [lowerPrice, upperPrice, pool]);

  // === HANDLERS ===
  const togglePriceMode = () => {
    const newMode = priceMode === 'token' ? 'usd' : 'token';
    const lNum = parseFloat(lowerPriceStr);
    const uNum = parseFloat(upperPriceStr);
    if (lNum && uNum) {
      if (newMode === 'usd') {
        // Convert from pool price to USD
        const lUsd = (priceMode === 'token' ? lNum : lNum) * token1Price;
        const uUsd = (priceMode === 'token' ? uNum : uNum) * token1Price;
        setLowerPriceStr(lUsd.toFixed(2));
        setUpperPriceStr(uUsd.toFixed(2));
      } else {
        // Convert from USD to pool price
        const lPool = lNum / token1Price;
        const uPool = uNum / token1Price;
        const dec = lPool >= 1 ? 4 : 8;
        setLowerPriceStr(lPool.toFixed(dec));
        setUpperPriceStr(uPool.toFixed(dec));
      }
    }
    setPriceMode(newMode);
  };

  const adjustPrice = (which: 'lower' | 'upper', delta: number) => {
    const setter = which === 'lower' ? setLowerPriceStr : setUpperPriceStr;
    const current = parseFloat(which === 'lower' ? lowerPriceStr : upperPriceStr) || 0;
    const step = current * 0.01 * delta; // 1% step
    const newVal = Math.max(0.0001, current + step);
    const dec = priceMode === 'usd' ? 2 : (newVal >= 1 ? 4 : 8);
    setter(newVal.toFixed(dec));
  };

  const handleCopyAddress = () => {
    navigator.clipboard.writeText(pool.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleMatchTicks = () => {
    if (lowerPrice > 0 && upperPrice > 0) {
      const lTick = nearestUsableTick(
        priceToTick(lowerPrice, pool.token0.decimals, pool.token1.decimals),
        pool.tickSpacing
      );
      const uTick = nearestUsableTick(
        priceToTick(upperPrice, pool.token0.decimals, pool.token1.decimals),
        pool.tickSpacing
      );
      const newLower = tickToPrice(lTick, pool.token0.decimals, pool.token1.decimals);
      const newUpper = tickToPrice(uTick, pool.token0.decimals, pool.token1.decimals);
      if (priceMode === 'usd') {
        setLowerPriceStr(poolPriceToUsd(newLower).toFixed(2));
        setUpperPriceStr(poolPriceToUsd(newUpper).toFixed(2));
      } else {
        const dec = newLower >= 1 ? 4 : 8;
        setLowerPriceStr(newLower.toFixed(dec));
        setUpperPriceStr(newUpper.toFixed(dec));
      }
    }
  };

  const handleFullRange = () => {
    setFullRange(!fullRange);
    if (!fullRange) {
      // Set to very wide range
      const lower = currentPrice * 0.01;
      const upper = currentPrice * 100;
      if (priceMode === 'usd') {
        setLowerPriceStr(poolPriceToUsd(lower).toFixed(2));
        setUpperPriceStr(poolPriceToUsd(upper).toFixed(2));
      } else {
        setLowerPriceStr(lower.toFixed(lower >= 1 ? 4 : 8));
        setUpperPriceStr(upper.toFixed(upper >= 1 ? 4 : 8));
      }
    }
  };

  // Chain slug for links
  const chainSlug: Record<string, string> = {
    ethereum: 'ethereum', arbitrum: 'arbitrum', polygon: 'polygon',
    optimism: 'optimism', base: 'base', bsc: 'bnb',
  };

  const version = pool.exchange.includes('v4') ? 'V4' : 'V3';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Pool Info Bar */}
      <Card className="p-4 mb-4">
        <div className="flex flex-wrap items-center gap-3">
          <TokenPairIcon token0Symbol={pool.token0.symbol} token1Symbol={pool.token1.symbol} size="lg" />
          <span className="text-lg font-semibold">{pool.token0.symbol}</span>
          <ArrowLeftRight className="w-4 h-4 text-muted" />
          <span className="text-lg font-semibold">{pool.token1.symbol}</span>

          <span className="px-2 py-0.5 bg-pink-500/20 text-pink-400 rounded text-xs">🦄</span>
          <span className="px-2 py-0.5 bg-primary/10 text-primary rounded text-xs font-semibold">{version}</span>
          <span className="px-2 py-0.5 bg-blue-500/20 text-blue-300 rounded text-xs">⚡</span>
          <span className="px-2 py-0.5 bg-card-hover rounded text-xs text-muted">{pool.feeTier / 10000}%</span>

          <button
            onClick={handleCopyAddress}
            className="flex items-center gap-1.5 px-2 py-0.5 bg-card-hover rounded text-xs text-muted hover:text-foreground transition-colors"
          >
            {shortenAddress(pool.id)}
            <Copy className="w-3 h-3" />
          </button>
          {copied && <span className="text-xs text-success">Copied!</span>}

          <div className="flex items-center gap-2 ml-auto">
            <a
              href={`https://app.uniswap.org/explore/pools/${chainSlug[pool.network] || 'ethereum'}/${pool.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 hover:bg-card-hover rounded transition-colors"
            >
              <ExternalLink className="w-4 h-4 text-muted" />
            </a>
            <button className="p-1.5 hover:bg-card-hover rounded transition-colors">
              <Share2 className="w-4 h-4 text-muted" />
            </button>
            <button className="p-1.5 hover:bg-card-hover rounded transition-colors">
              <Star className="w-4 h-4 text-muted" />
            </button>
          </div>
        </div>

        <div className="flex gap-3 mt-3">
          <button className="px-4 py-2 bg-primary/20 text-primary rounded-lg text-sm font-medium hover:bg-primary/30 transition-colors">
            <Bookmark className="w-4 h-4 inline mr-1.5" />
            Save to Portfolio
          </button>
          <button
            onClick={onChangePool}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors"
          >
            Change Pool
          </button>
        </div>
      </Card>

      {/* Main Grid: Left Column + Right Column */}
      <div className="grid lg:grid-cols-[420px_1fr] gap-4">
        {/* LEFT COLUMN */}
        <div className="space-y-4">
          {/* Estimated Fees (24h) */}
          <Card className="p-5">
            <p className="text-sm font-medium mb-1">
              Estimated Fees <span className="text-primary">(24h)</span>
            </p>
            <p className="text-3xl font-bold text-primary mb-4">
              {formatCurrency(feeEstimation.fees24h)}
            </p>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted">Monthly</span>
                <div className="flex items-center gap-3">
                  <span className="text-sm">{formatPercent(feeEstimation.monthlyPct, false)}</span>
                  <span className="px-3 py-1 bg-card-hover rounded text-sm">{formatCurrency(feeEstimation.monthlyUSD)}</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted">Yearly (APR)</span>
                <div className="flex items-center gap-3">
                  <span className="text-sm">{formatPercent(feeEstimation.yearlyAPR, false)}</span>
                  <span className="px-3 py-1 bg-card-hover rounded text-sm">{formatCurrency(feeEstimation.fees24h * 365)}</span>
                </div>
              </div>
            </div>

            <button className="w-full mt-4 py-2.5 bg-gradient-to-r from-purple-600 to-purple-500 text-white rounded-lg text-sm font-medium hover:from-purple-700 hover:to-purple-600 transition-all">
              Simulate Position Performance
            </button>
          </Card>

          {/* Liquidity Price Range */}
          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="font-medium">Liquidity Price Range</p>
                <p className="text-xs text-muted">
                  ({priceMode === 'usd' ? 'USD' : `${pool.token1.symbol} per ${pool.token0.symbol}`})
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleMatchTicks}
                  className="px-3 py-1 border border-primary text-primary rounded-full text-xs font-medium hover:bg-primary/10 transition-colors"
                >
                  Match Ticks
                </button>
                <button
                  onClick={togglePriceMode}
                  className="flex items-center gap-1.5 px-3 py-1 border border-border rounded-full text-xs font-medium hover:bg-card-hover transition-colors"
                >
                  <ArrowLeftRight className="w-3 h-3" />
                  {priceMode === 'token' ? 'USD' : pool.token1.symbol}
                </button>
              </div>
            </div>

            {/* Full Range Toggle */}
            <div className="flex items-center justify-end gap-2 mb-4">
              <span className="text-xs text-muted">Full Range:</span>
              <button
                onClick={handleFullRange}
                className={cn(
                  'w-10 h-5 rounded-full transition-colors relative',
                  fullRange ? 'bg-primary' : 'bg-gray-600'
                )}
              >
                <div className={cn(
                  'w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all',
                  fullRange ? 'left-5.5' : 'left-0.5'
                )} style={{ left: fullRange ? '22px' : '2px' }} />
              </button>
            </div>

            {/* Calculation Controls */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-background rounded-lg p-3">
                <p className="text-xs text-muted mb-2">Calculation Timeframe (Days)</p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCalculationDays(Math.max(1, calculationDays - 1))}
                    className="p-1 hover:bg-card-hover rounded transition-colors"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="font-medium text-center flex-1">{calculationDays}</span>
                  <button
                    onClick={() => setCalculationDays(calculationDays + 1)}
                    className="p-1 hover:bg-card-hover rounded transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="bg-background rounded-lg p-3">
                <p className="text-xs text-muted mb-2">Calculation Method</p>
                <div className="relative">
                  <select
                    value={calculationMethod}
                    onChange={(e) => setCalculationMethod(e.target.value as 'average' | 'geometric')}
                    className="w-full appearance-none bg-transparent text-sm font-medium pr-6 cursor-pointer focus:outline-none"
                  >
                    <option value="average">Average Liquidity</option>
                    <option value="geometric">Geometric Mean</option>
                  </select>
                  <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Price Inputs */}
            <div className="mb-2">
              <p className="text-sm font-medium mb-3">Price</p>
              <div className="grid grid-cols-2 gap-3">
                {/* Min Price */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-muted">Min Price</span>
                    <span className="text-xs text-muted">({lowerPctChange >= 0 ? '+' : ''}{lowerPctChange.toFixed(2)}%)</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => adjustPrice('lower', -1)}
                      className="p-1.5 bg-card-hover rounded hover:bg-background transition-colors"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <input
                      type="number"
                      value={lowerPriceStr}
                      onChange={(e) => setLowerPriceStr(e.target.value)}
                      className="w-full px-2 py-1.5 bg-background border border-border rounded text-sm text-center focus:outline-none focus:ring-1 focus:ring-primary"
                      step="any"
                    />
                    <button
                      onClick={() => adjustPrice('lower', 1)}
                      className="p-1.5 bg-card-hover rounded hover:bg-background transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                  <p className="text-xs text-muted mt-1">
                    ≈ {getEquivalentDisplay(lowerPriceStr)}
                    {priceMode === 'token' ? '' : ` ${pool.token1.symbol}`}
                  </p>
                </div>

                {/* Max Price */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-muted">Max Price</span>
                    <span className="text-xs text-muted">({upperPctChange >= 0 ? '+' : ''}{upperPctChange.toFixed(2)}%)</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => adjustPrice('upper', -1)}
                      className="p-1.5 bg-card-hover rounded hover:bg-background transition-colors"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <input
                      type="number"
                      value={upperPriceStr}
                      onChange={(e) => setUpperPriceStr(e.target.value)}
                      className="w-full px-2 py-1.5 bg-background border border-border rounded text-sm text-center focus:outline-none focus:ring-1 focus:ring-primary"
                      step="any"
                    />
                    <button
                      onClick={() => adjustPrice('upper', 1)}
                      className="p-1.5 bg-card-hover rounded hover:bg-background transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                  <p className="text-xs text-muted mt-1">
                    ≈ {getEquivalentDisplay(upperPriceStr)}
                    {priceMode === 'token' ? '' : ` ${pool.token1.symbol}`}
                  </p>
                </div>
              </div>
            </div>

            {/* Range Slider */}
            <div className="relative mt-4 mb-2">
              <div className="h-1.5 bg-gray-700 rounded-full relative">
                <div
                  className="absolute h-full bg-purple-500/50 rounded-full"
                  style={{
                    left: `${Math.max(0, Math.min(100, ((lowerPrice - currentPrice * 0.5) / (currentPrice * 1.0)) * 100))}%`,
                    width: `${Math.max(5, Math.min(100, ((upperPrice - lowerPrice) / (currentPrice * 1.0)) * 100))}%`,
                  }}
                />
              </div>
              <div className="flex justify-between mt-1">
                <div className="w-3 h-3 bg-purple-500 rounded-full border-2 border-card" />
                <div className="w-3 h-3 bg-purple-500 rounded-full border-2 border-card" />
              </div>
            </div>
          </Card>

          {/* Deposit Amount */}
          <Card className="p-5">
            <p className="font-medium mb-3">Deposit Amount</p>
            <div className="relative mb-4">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted">$</span>
              <input
                type="number"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                className="w-full pl-7 pr-3 py-2.5 bg-background border border-border rounded-lg text-lg font-medium focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="0"
              />
            </div>

            {/* Token Breakdown */}
            <div className="space-y-3 mb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TokenIcon symbol={pool.token0.symbol} size="sm" />
                  <span className="text-sm font-medium">{pool.token0.symbol}</span>
                </div>
                <div className="text-right">
                  <p className="text-sm">
                    {formatNumber(tokenAmounts.token0Amount, 4)}{' '}
                    <span className="text-muted">({token0Pct.toFixed(2)}%)</span>
                  </p>
                  <p className="text-xs text-muted">{formatCurrency(token0ValueUSD)}</p>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TokenIcon symbol={pool.token1.symbol} size="sm" />
                  <span className="text-sm font-medium">{pool.token1.symbol}</span>
                </div>
                <div className="text-right">
                  <p className="text-sm">
                    {formatNumber(tokenAmounts.token1Amount, 4)}{' '}
                    <span className="text-muted">({token1Pct.toFixed(2)}%)</span>
                  </p>
                  <p className="text-xs text-muted">{formatCurrency(token1ValueUSD)}</p>
                </div>
              </div>
            </div>

            <button className="w-full py-2.5 bg-gradient-to-r from-purple-600 to-purple-500 text-white rounded-lg text-sm font-medium hover:from-purple-700 hover:to-purple-600 transition-all">
              Create Position
            </button>
          </Card>

          {/* Pool Stats */}
          <Card className="p-5">
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              <div>
                <p className="text-xs text-muted">Price Volatility</p>
                <p className="text-sm font-semibold">{poolStats.priceVolatility.toFixed(2)}%</p>
              </div>
              <div>
                <p className="text-xs text-muted">TVL</p>
                <p className="text-sm font-semibold">${formatCompactNumber(pool.tvl)}</p>
              </div>
              <div>
                <p className="text-xs text-muted">AVG Daily Fees</p>
                <p className="text-sm font-semibold">${formatCompactNumber(poolStats.avgDailyFees)}</p>
              </div>
              <div>
                <p className="text-xs text-muted">Daily Fees / TVL</p>
                <p className="text-sm font-semibold">{poolStats.dailyFeesToTvl.toFixed(4)}%</p>
              </div>
              <div>
                <p className="text-xs text-muted">AVG Daily Volume</p>
                <p className="text-sm font-semibold">${formatCompactNumber(poolStats.avgDailyVolume)}</p>
              </div>
              <div>
                <p className="text-xs text-muted">Daily Volume / TVL</p>
                <p className="text-sm font-semibold">{poolStats.dailyVolumeToTvl.toFixed(2)}%</p>
              </div>
              <div>
                <p className="text-xs text-muted">Correlation</p>
                <p className="text-sm font-semibold">{poolStats.correlation.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-xs text-muted">Geometric Mean</p>
                <p className="text-sm font-semibold">{formatNumber(poolStats.geometricMean, 4)}</p>
              </div>
            </div>
          </Card>
        </div>

        {/* RIGHT COLUMN */}
        <div className="space-y-4">
          {isLoadingData ? (
            <Card className="p-12 text-center">
              <RefreshCw className="w-8 h-8 text-muted mx-auto mb-3 animate-spin" />
              <p className="text-muted">Loading pool data...</p>
            </Card>
          ) : (
            <>
              {/* Liquidity Distribution */}
              <LiquidityDistributionChart
                bins={liquidityBins}
                currentPrice={currentPrice}
                token0Symbol={pool.token0.symbol}
                token1Symbol={pool.token1.symbol}
                lowerPrice={lowerPrice}
                upperPrice={upperPrice}
                ticksInRange={ticksInRange}
              />

              {/* Pool Price Chart */}
              <PoolPriceChart
                dayData={dayData}
                currentPrice={currentPrice}
                token0Symbol={pool.token0.symbol}
                token1Symbol={pool.token1.symbol}
                minPrice={lowerPrice}
                maxPrice={upperPrice}
              />

              {/* Volume History */}
              <VolumeHistoryChart dayData={dayData} />

              {/* Position Breakdown */}
              <PositionBreakdownChart
                pool={pool}
                depositAmount={deposit}
                currentPrice={currentPrice}
                lowerPrice={lowerPrice}
                upperPrice={upperPrice}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
