'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { TokenPairIcon } from '@/components/ui/TokenIcon';
import { Pool, SimulationResult } from '@/types';
import {
  formatCurrency,
  formatPercent,
  formatNumber,
  calculateConcentrationFactor,
  calculateTimeInRange,
  calculateExpectedIL,
  calculateTokenAmounts,
  getPoolPrice,
} from '@/lib/utils';
import { Calculator, AlertTriangle, Info, DollarSign, Percent, Calendar, ArrowLeftRight } from 'lucide-react';

interface SimulationFormProps {
  pool: Pool | null;
  onSimulate: (result: SimulationResult) => void;
}

export function SimulationForm({ pool, onSimulate }: SimulationFormProps) {
  const [depositAmount, setDepositAmount] = useState<string>('1000');
  const [lowerPrice, setLowerPrice] = useState<string>('');
  const [upperPrice, setUpperPrice] = useState<string>('');
  const [days, setDays] = useState<string>('30');
  const [isSimulating, setIsSimulating] = useState(false);
  const [priceMode, setPriceMode] = useState<'token' | 'usd'>('token');

  // Conversion helpers: pool price (token1 per token0) <-> USD price of token0
  const token1UsdPrice = pool?.token1.price || 1;
  const poolPriceToUsd = (poolPrice: number) => poolPrice * token1UsdPrice;
  const usdToPoolPrice = (usdPrice: number) => usdPrice / token1UsdPrice;

  const formatPriceDisplay = (value: string, mode: 'token' | 'usd') => {
    const num = parseFloat(value);
    if (!num || isNaN(num)) return '';
    const converted = mode === 'usd' ? poolPriceToUsd(num) : usdToPoolPrice(num);
    const decimals = converted >= 1000 ? 2 : converted >= 1 ? 4 : 8;
    return converted.toFixed(decimals);
  };

  // Calculate current price using the most accurate method available
  // Priority: sqrtPriceX96 > currentTick > USD price ratio
  const currentPrice = pool
    ? getPoolPrice(
        pool.sqrtPriceX96,
        pool.currentTick,
        pool.token0.decimals,
        pool.token1.decimals,
        pool.token0.price,
        pool.token1.price
      )
    : 0;

  useEffect(() => {
    if (pool && currentPrice > 0) {
      // Set default range to -10% to +10% of current price
      const lowerPool = currentPrice * 0.9;
      const upperPool = currentPrice * 1.1;
      if (priceMode === 'usd') {
        const lUsd = poolPriceToUsd(lowerPool);
        const uUsd = poolPriceToUsd(upperPool);
        const decimals = lUsd >= 1000 ? 2 : lUsd >= 1 ? 4 : 8;
        setLowerPrice(lUsd.toFixed(decimals));
        setUpperPrice(uUsd.toFixed(decimals));
      } else {
        const decimals = lowerPool >= 1000 ? 2 : lowerPool >= 1 ? 4 : 8;
        setLowerPrice(lowerPool.toFixed(decimals));
        setUpperPrice(upperPool.toFixed(decimals));
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pool, currentPrice]);

  const handleSimulate = async () => {
    if (!pool) return;

    setIsSimulating(true);

    // Simulate calculation delay for UX
    await new Promise((resolve) => setTimeout(resolve, 500));

    const deposit = parseFloat(depositAmount) || 0;
    const rawLower = parseFloat(lowerPrice) || 0;
    const rawUpper = parseFloat(upperPrice) || 0;
    // Convert to pool price (token1 per token0) if in USD mode
    const lower = priceMode === 'usd' ? usdToPoolPrice(rawLower) : rawLower;
    const upper = priceMode === 'usd' ? usdToPoolPrice(rawUpper) : rawUpper;
    const numDays = parseInt(days) || 30;

    // Validate inputs
    if (lower >= upper || lower <= 0 || upper <= 0) {
      setIsSimulating(false);
      return;
    }

    // Calculate position status
    const inRange = currentPrice >= lower && currentPrice <= upper;

    // Calculate concentration factor (capital efficiency multiplier)
    const concentrationFactor = calculateConcentrationFactor(currentPrice, lower, upper);

    // Estimate time in range using statistical model
    const estimatedVolatility = pool.volume24h > 0 && pool.tvl > 0
      ? Math.min(1.0, (pool.volume24h / pool.tvl) * 365 * 0.5) // Rough volatility estimate
      : 0.5;
    const timeInRange = calculateTimeInRange(currentPrice, lower, upper, numDays, estimatedVolatility);

    // Calculate fees earned with concentration factor
    const dailyRate = pool.apr / 365 / 100;
    const baseFees = deposit * dailyRate * numDays;
    // Concentration boost is capped and adjusted by time in range
    const effectiveConcentration = Math.min(concentrationFactor, 20); // Cap at 20x
    const adjustedFees = baseFees * effectiveConcentration * timeInRange;

    // Calculate impermanent loss at expected price movements
    const expectedIL = calculateExpectedIL(currentPrice, lower, upper, estimatedVolatility);
    const ilDollar = deposit * expectedIL;

    // Calculate token amounts based on position in range
    const { token0Amount, token1Amount } = calculateTokenAmounts(
      deposit,
      currentPrice,
      lower,
      upper,
      pool.token0.price || 1,
      pool.token1.price || 1
    );

    // Generate deterministic daily fees projection
    const dailyFees = Array.from({ length: numDays }, (_, day) => {
      // Model fee variation based on time in range probability
      const dayProgress = day / numDays;
      // Slight sine wave for realistic variance without randomness
      const varianceFactor = 1 + 0.15 * Math.sin(dayProgress * Math.PI * 4);
      const baseDailyFee = adjustedFees / numDays;
      return baseDailyFee * varianceFactor;
    });

    const result: SimulationResult = {
      estimatedFees: adjustedFees,
      estimatedAPR: deposit > 0 ? (adjustedFees / deposit) * (365 / numDays) * 100 : 0,
      impermanentLoss: ilDollar,
      netReturn: adjustedFees - ilDollar,
      token0Amount,
      token1Amount,
      inRange,
      timeInRange: timeInRange * 100,
      dailyFees,
    };

    onSimulate(result);
    setIsSimulating(false);
  };

  const setQuickRange = (percentage: number) => {
    if (currentPrice > 0) {
      const lowerPool = currentPrice * (1 - percentage / 100);
      const upperPool = currentPrice * (1 + percentage / 100);
      if (priceMode === 'usd') {
        const lUsd = poolPriceToUsd(lowerPool);
        const uUsd = poolPriceToUsd(upperPool);
        const decimals = lUsd >= 1000 ? 2 : lUsd >= 1 ? 4 : 8;
        setLowerPrice(lUsd.toFixed(decimals));
        setUpperPrice(uUsd.toFixed(decimals));
      } else {
        const decimals = lowerPool >= 1000 ? 2 : lowerPool >= 1 ? 4 : 8;
        setLowerPrice(lowerPool.toFixed(decimals));
        setUpperPrice(upperPool.toFixed(decimals));
      }
    }
  };

  if (!pool) {
    return (
      <Card className="p-8 text-center">
        <Calculator className="w-12 h-12 text-muted mx-auto mb-4" />
        <h3 className="text-lg font-medium mb-2">Select a Pool to Simulate</h3>
        <p className="text-sm text-muted">
          Choose a liquidity pool from above to start simulating returns
        </p>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <TokenPairIcon
              token0Symbol={pool.token0.symbol}
              token1Symbol={pool.token1.symbol}
              size="lg"
            />
            <div>
              <h3 className="font-semibold">
                {pool.token0.symbol}/{pool.token1.symbol}
              </h3>
              <span className="text-xs text-muted">{pool.feeTier / 10000}% fee tier</span>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted">Current Price</p>
            <p className="font-medium">
              {currentPrice >= 1000
                ? formatNumber(currentPrice, 2)
                : currentPrice >= 1
                  ? formatNumber(currentPrice, 4)
                  : currentPrice.toPrecision(4)}
            </p>
            <p className="text-xs text-muted">{pool.token1.symbol} per {pool.token0.symbol}</p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Deposit Amount */}
        <div>
          <label className="flex items-center gap-2 text-sm font-medium mb-2">
            <DollarSign className="w-4 h-4 text-muted" />
            Deposit Amount (USD)
          </label>
          <Input
            type="number"
            value={depositAmount}
            onChange={(e) => setDepositAmount(e.target.value)}
            placeholder="Enter amount"
          />
          <div className="flex gap-2 mt-2">
            {[100, 500, 1000, 5000, 10000].map((amount) => (
              <button
                key={amount}
                onClick={() => setDepositAmount(amount.toString())}
                className="px-2 py-1 text-xs bg-card-hover rounded hover:bg-primary/20 transition-colors"
              >
                ${formatNumber(amount, 0)}
              </button>
            ))}
          </div>
        </div>

        {/* Price Range */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="flex items-center gap-2 text-sm font-medium">
              <Percent className="w-4 h-4 text-muted" />
              Price Range
              <span className="text-muted font-normal">
                ({priceMode === 'token' ? `${pool.token1.symbol} per ${pool.token0.symbol}` : 'USD'})
              </span>
            </label>
            <button
              onClick={() => {
                const newMode = priceMode === 'token' ? 'usd' : 'token';
                // Convert current values to new mode
                const lNum = parseFloat(lowerPrice);
                const uNum = parseFloat(upperPrice);
                if (lNum && uNum) {
                  if (newMode === 'usd') {
                    const lUsd = poolPriceToUsd(lNum);
                    const uUsd = poolPriceToUsd(uNum);
                    const dec = lUsd >= 1000 ? 2 : lUsd >= 1 ? 4 : 8;
                    setLowerPrice(lUsd.toFixed(dec));
                    setUpperPrice(uUsd.toFixed(dec));
                  } else {
                    const lPool = usdToPoolPrice(lNum);
                    const uPool = usdToPoolPrice(uNum);
                    const dec = lPool >= 1000 ? 2 : lPool >= 1 ? 4 : 8;
                    setLowerPrice(lPool.toFixed(dec));
                    setUpperPrice(uPool.toFixed(dec));
                  }
                }
                setPriceMode(newMode);
              }}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-card-hover hover:bg-primary/20 rounded-lg transition-colors"
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
              {priceMode === 'token' ? 'USD' : pool.token1.symbol}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className="text-xs text-muted block mb-1">Min Price</span>
              <Input
                type="number"
                value={lowerPrice}
                onChange={(e) => setLowerPrice(e.target.value)}
                placeholder="0.00"
                step="any"
              />
              <span className="text-xs text-muted mt-1 block">
                {priceMode === 'token'
                  ? `≈ $${formatPriceDisplay(lowerPrice, 'token')}`
                  : `≈ ${formatPriceDisplay(lowerPrice, 'usd')} ${pool.token1.symbol}`}
              </span>
            </div>
            <div>
              <span className="text-xs text-muted block mb-1">Max Price</span>
              <Input
                type="number"
                value={upperPrice}
                onChange={(e) => setUpperPrice(e.target.value)}
                placeholder="0.00"
                step="any"
              />
              <span className="text-xs text-muted mt-1 block">
                {priceMode === 'token'
                  ? `≈ $${formatPriceDisplay(upperPrice, 'token')}`
                  : `≈ ${formatPriceDisplay(upperPrice, 'usd')} ${pool.token1.symbol}`}
              </span>
            </div>
          </div>
          <div className="flex gap-2 mt-2">
            {[5, 10, 25, 50, 100].map((pct) => (
              <button
                key={pct}
                onClick={() => setQuickRange(pct)}
                className="px-2 py-1 text-xs bg-card-hover rounded hover:bg-primary/20 transition-colors"
              >
                ±{pct}%
              </button>
            ))}
          </div>
        </div>

        {/* Simulation Period */}
        <div>
          <label className="flex items-center gap-2 text-sm font-medium mb-2">
            <Calendar className="w-4 h-4 text-muted" />
            Simulation Period (Days)
          </label>
          <Input
            type="number"
            value={days}
            onChange={(e) => setDays(e.target.value)}
            placeholder="30"
          />
          <div className="flex gap-2 mt-2">
            {[7, 14, 30, 90, 180, 365].map((d) => (
              <button
                key={d}
                onClick={() => setDays(d.toString())}
                className="px-2 py-1 text-xs bg-card-hover rounded hover:bg-primary/20 transition-colors"
              >
                {d}d
              </button>
            ))}
          </div>
        </div>

        {/* Pool Stats */}
        <div className="bg-background rounded-lg p-4 space-y-2">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <Info className="w-4 h-4 text-muted" />
            Pool Statistics
          </h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted">TVL</span>
              <span className="float-right">{formatCurrency(pool.tvl, true)}</span>
            </div>
            <div>
              <span className="text-muted">24h Volume</span>
              <span className="float-right">{formatCurrency(pool.volume24h, true)}</span>
            </div>
            <div>
              <span className="text-muted">24h Fees</span>
              <span className="float-right">{formatCurrency(pool.fees24h, true)}</span>
            </div>
            <div>
              <span className="text-muted">Current APR</span>
              <span className="float-right text-success">{formatPercent(pool.apr, false)}</span>
            </div>
          </div>
        </div>

        {/* Warning */}
        <div className="flex items-start gap-3 p-3 bg-warning/10 border border-warning/20 rounded-lg">
          <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
          <p className="text-sm text-warning">
            This simulation is for educational purposes only. Actual returns may vary significantly due to market conditions, impermanent loss, and other factors.
          </p>
        </div>

        {/* Simulate Button */}
        <Button
          onClick={handleSimulate}
          disabled={isSimulating || !depositAmount || !lowerPrice || !upperPrice}
          className="w-full"
          size="lg"
        >
          {isSimulating ? (
            <>
              <span className="animate-spin mr-2">
                <Calculator className="w-4 h-4" />
              </span>
              Simulating...
            </>
          ) : (
            <>
              <Calculator className="w-4 h-4 mr-2" />
              Run Simulation
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
