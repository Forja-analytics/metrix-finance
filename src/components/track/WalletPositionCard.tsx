'use client';

import { Card } from '@/components/ui/Card';
import { TokenPairIcon } from '@/components/ui/TokenIcon';
import { OnChainPosition } from '@/hooks/usePositions';
import { PositionHistory } from '@/lib/uniswap-subgraph';
import { V4PositionHistory } from '@/lib/v4-subgraph';
import { formatNumber, cn } from '@/lib/utils';
import { useEffect, useState } from 'react';
import { fetchTokenPrices } from '@/lib/api';

interface WalletPositionCardProps {
  position: OnChainPosition;
  prices?: Record<string, number>;
  positionHistory?: PositionHistory | null;
  v4PositionHistory?: V4PositionHistory | null;
}

// Format large liquidity values in a human-readable way
function formatCompactLiquidity(liquidity: bigint): string {
  const num = Number(liquidity);
  if (num >= 1e18) return (num / 1e18).toFixed(2) + 'E';
  if (num >= 1e15) return (num / 1e15).toFixed(2) + 'P';
  if (num >= 1e12) return (num / 1e12).toFixed(2) + 'T';
  if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
  if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
  if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
  return num.toFixed(2);
}

// Convert tick to price with decimal adjustment
function tickToPrice(tick: number, decimals0: number, decimals1: number): number {
  return Math.pow(1.0001, tick) * Math.pow(10, decimals0 - decimals1);
}

// Format price for display
function formatPrice(price: number): string {
  if (price >= 1000000) return (price / 1000000).toFixed(2) + 'M';
  if (price >= 1000) return (price / 1000).toFixed(2) + 'K';
  if (price >= 1) return price.toFixed(2);
  if (price >= 0.0001) return price.toFixed(6);
  return price.toExponential(2);
}

// Price Range Slider Component with Tooltip
function PriceRangeSlider({ tickLower, tickUpper, currentTick, inRange, token0Decimals, token1Decimals, token0Symbol, token1Symbol, token0Price, token1Price }: {
  tickLower: number;
  tickUpper: number;
  currentTick?: number;
  inRange: boolean;
  token0Decimals?: number;
  token1Decimals?: number;
  token0Symbol?: string;
  token1Symbol?: string;
  token0Price?: number;
  token1Price?: number;
}) {
  const [showTooltip, setShowTooltip] = useState(false);

  // Calculate the position of the current tick within the range
  // We need to visualize where the current price is relative to the position's range
  const rangeWidth = tickUpper - tickLower;
  const padding = rangeWidth * 0.2; // 20% padding on each side for visualization
  const visualMin = tickLower - padding;
  const visualMax = tickUpper + padding;
  const visualRange = visualMax - visualMin;

  // Position percentages
  const lowerPercent = ((tickLower - visualMin) / visualRange) * 100;
  const upperPercent = ((tickUpper - visualMin) / visualRange) * 100;
  const currentPercent = currentTick !== undefined
    ? Math.max(0, Math.min(100, ((currentTick - visualMin) / visualRange) * 100))
    : 50;

  // Calculate prices from ticks
  const decimals0 = token0Decimals || 18;
  const decimals1 = token1Decimals || 18;
  const minPrice = tickToPrice(tickLower, decimals0, decimals1);
  const maxPrice = tickToPrice(tickUpper, decimals0, decimals1);
  const currentPrice = currentTick !== undefined
    ? tickToPrice(currentTick, decimals0, decimals1)
    : (minPrice + maxPrice) / 2;

  // Calculate USD values (price of token0 in terms of token1, then convert to USD)
  // For a pool like WETH/USDC, if token0=WETH and token1=USDC:
  // - minPrice/maxPrice/currentPrice are in token1 per token0 (e.g., USDC per WETH)
  // - To get USD value: multiply by token1Price (which is $1 for USDC)
  const t1Price = token1Price || 1;
  const minPriceUSD = minPrice * t1Price;
  const maxPriceUSD = maxPrice * t1Price;
  const currentPriceUSD = currentPrice * t1Price;

  return (
    <div
      className="relative w-full h-2 mt-2 cursor-pointer group"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {/* Tooltip */}
      {showTooltip && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg shadow-lg z-50 whitespace-nowrap text-xs">
          <div className="space-y-1">
            <div className="flex justify-between gap-4">
              <span className="text-muted">Min:</span>
              <span className="font-medium">${formatPrice(minPriceUSD)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted">Current:</span>
              <span className={cn("font-medium", inRange ? "text-success" : "text-danger")}>
                ${formatPrice(currentPriceUSD)}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted">Max:</span>
              <span className="font-medium">${formatPrice(maxPriceUSD)}</span>
            </div>
            <div className="text-[10px] text-muted mt-1 pt-1 border-t border-gray-700">
              {token1Symbol || 'Token1'} per {token0Symbol || 'Token0'}
            </div>
          </div>
          {/* Tooltip arrow */}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
        </div>
      )}

      {/* Background track */}
      <div className="absolute inset-0 bg-gray-700 rounded-full" />

      {/* Active range */}
      <div
        className="absolute h-full bg-gray-500 rounded-full"
        style={{
          left: `${lowerPercent}%`,
          width: `${upperPercent - lowerPercent}%`,
        }}
      />

      {/* Lower bound marker */}
      <div
        className="absolute w-2 h-2 bg-purple-500 rounded-full -translate-x-1/2 top-0"
        style={{ left: `${lowerPercent}%` }}
      />

      {/* Upper bound marker */}
      <div
        className="absolute w-2 h-2 bg-purple-500 rounded-full -translate-x-1/2 top-0"
        style={{ left: `${upperPercent}%` }}
      />

      {/* Current price marker */}
      {currentTick !== undefined && (
        <div
          className={cn(
            "absolute w-3 h-3 rounded-full -translate-x-1/2 -top-0.5 border-2 border-card",
            inRange ? "bg-success" : "bg-danger"
          )}
          style={{ left: `${currentPercent}%` }}
        />
      )}
    </div>
  );
}

export function WalletPositionCard({ position, prices: externalPrices, positionHistory, v4PositionHistory }: WalletPositionCardProps) {
  // Debug: Log when component renders
  console.log('[WalletPositionCard] Rendering position:', position.tokenId.toString());

  const [localPrices, setLocalPrices] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!externalPrices) {
      fetchTokenPrices().then(setLocalPrices);
    }
  }, [externalPrices]);

  const prices = externalPrices || localPrices;

  const token0Symbol = position.token0Symbol || 'TOKEN0';
  const token1Symbol = position.token1Symbol || 'TOKEN1';
  const token0Decimals = position.token0Decimals || 18;
  const token1Decimals = position.token1Decimals || 18;
  const chainName = position.chainName || 'Unknown';
  const chainId = position.chainId || 1;

  // Chain slug for Uniswap URL
  const chainSlug: Record<number, string> = {
    1: 'ethereum',
    42161: 'arbitrum',
    137: 'polygon',
    10: 'optimism',
    8453: 'base',
    56: 'bnb',
  };

  // Use calculated token amounts if available
  const token0Amount = position.token0Amount || 0;
  const token1Amount = position.token1Amount || 0;

  // Get token prices
  const token0Price = prices[token0Symbol] || prices['ETH'] || 0;
  const token1Price = prices[token1Symbol] || 0;

  // Calculate position value in USD
  const token0ValueUSD = token0Amount * token0Price;
  const token1ValueUSD = token1Amount * token1Price;
  const totalValueUSD = token0ValueUSD + token1ValueUSD;

  // Calculate uncollected fees in USD
  // Both V3 and V4 positions use pre-calculated uncollectedFees from the hook
  const isV4 = position.version === 'v4';
  const uncollectedFees0 = position.uncollectedFees0 || 0;
  const uncollectedFees1 = position.uncollectedFees1 || 0;

  const unclaimedFeesUSD = (uncollectedFees0 * token0Price) + (uncollectedFees1 * token1Price);

  // Use calculated inRange if available, otherwise fallback
  const inRange = position.inRange !== undefined ? position.inRange : Number(position.liquidity) > 0;

  // Fee tier display
  const feePercent = position.fee / 10000;

  // Get historical data from position history (if available)
  // Use V4 history for V4 positions, V3 history for V3 positions
  let originalInvestmentUSD = totalValueUSD; // Historical USD value at deposit time (for P&L)
  let depositsAtCurrentPrices = totalValueUSD; // Deposits valued at current prices (for HODL calc)
  let claimedFeesUSD = 0;

  if (isV4 && v4PositionHistory) {
    // V4: Use ModifyLiquidity events for deposits and claims
    const hasDepositData = v4PositionHistory.depositedToken0 > 0 || v4PositionHistory.depositedToken1 > 0;
    if (hasDepositData) {
      depositsAtCurrentPrices = (v4PositionHistory.depositedToken0 * token0Price) + (v4PositionHistory.depositedToken1 * token1Price);
      claimedFeesUSD = (v4PositionHistory.claimedToken0 * token0Price) + (v4PositionHistory.claimedToken1 * token1Price);
      // Use historical USD value if available, otherwise use deposits at current prices
      originalInvestmentUSD = v4PositionHistory.depositedUSD > 0
        ? v4PositionHistory.depositedUSD
        : depositsAtCurrentPrices;
    }
  } else if (!isV4 && positionHistory) {
    // V3: Use The Graph subgraph data
    depositsAtCurrentPrices = (positionHistory.depositedToken0 * token0Price) + (positionHistory.depositedToken1 * token1Price);
    claimedFeesUSD = (positionHistory.claimedFees0 * token0Price) + (positionHistory.claimedFees1 * token1Price);
    // Use historical USD value if available, otherwise use deposits at current prices
    originalInvestmentUSD = positionHistory.depositedUSD > 0
      ? positionHistory.depositedUSD
      : depositsAtCurrentPrices;
  }

  // Total earnings = unclaimed + claimed fees
  const earnings = unclaimedFeesUSD + claimedFeesUSD;

  // Safety check: ensure originalInvestmentUSD is reasonable for APR calculation
  // Use the HIGHER of: calculated investment OR current position value
  // This ensures APR is never artificially inflated by bad subgraph data
  const safeOriginalInvestment = Math.max(originalInvestmentUSD, totalValueUSD, 1);

  // Profit/Loss = Total Current Value (position + fees) - Original Investment
  // This is the actual capital gain/loss
  const currentTotalValue = totalValueUSD + unclaimedFeesUSD + claimedFeesUSD;
  const profitLoss = currentTotalValue - safeOriginalInvestment;

  // HODL value = original deposits valued at current prices
  const hodlValue = depositsAtCurrentPrices;
  // Impermanent Loss = HODL value - Current position value (not including fees)
  const impermanentLoss = hodlValue - totalValueUSD;
  // VS HODL = How much better/worse LP is vs just holding
  // VS HODL = (Current Position + Fees) - HODL Value = Earnings - IL
  const vsHodl = earnings - Math.max(0, impermanentLoss);

  // Get creation timestamp from the appropriate history source
  const createdTimestamp = isV4 && v4PositionHistory
    ? v4PositionHistory.createdTimestamp
    : positionHistory?.createdTimestamp;

  // Calculate position age in days (minimum 1 day to avoid division issues)
  // Also validate the timestamp is not in the future or too close to now
  const now = Date.now();
  const validTimestamp = createdTimestamp && createdTimestamp > 0 && createdTimestamp < now
    ? createdTimestamp
    : null;
  const rawPositionAgeDays = validTimestamp
    ? (now - validTimestamp) / (1000 * 60 * 60 * 24)
    : 30; // Default to 30 days if no valid history

  // Ensure minimum 1 day for APR calculation - this prevents inflated APR for new positions
  const positionAgeDays = Math.max(1, rawPositionAgeDays);

  // APR = (earnings / days) * 365 / current liquidity * 100
  // Use current liquidity value for APR (yield rate on current capital)
  // Cap APR at reasonable maximum (10,000%) to prevent display of absurd values from edge cases
  const aprBase = Math.max(totalValueUSD, 1);
  const rawApr = ((earnings / positionAgeDays) * 365 / aprBase) * 100;
  const apr = Math.min(rawApr, 10000); // Cap at 10,000% APR

  // Debug logging (remove in production)
  console.log('[WalletPositionCard] APR Calculation:', {
    tokenId: position.tokenId.toString(),
    version: position.version,
    totalValueUSD,
    aprBase,
    earnings,
    unclaimedFeesUSD,
    claimedFeesUSD,
    hasV4History: !!v4PositionHistory,
    hasV3History: !!positionHistory,
    createdTimestamp,
    positionAgeDays,
    rawApr,
    cappedApr: apr,
  });

  // Format opened date from position history
  const openedDate = createdTimestamp
    ? new Date(createdTimestamp).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : 'Unknown';

  return (
    <Card className="p-4 hover:bg-card-hover transition-colors">
      {/* Header Row */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <TokenPairIcon
            token0Symbol={token0Symbol}
            token1Symbol={token1Symbol}
            size="lg"
          />
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold">
                {token0Symbol}/{token1Symbol}
              </h3>
              <span className="px-1.5 py-0.5 bg-pink-500/20 text-pink-400 rounded text-xs font-medium">
                🦄
              </span>
              <span className="px-1.5 py-0.5 bg-success/10 text-success rounded text-xs font-semibold">
                {position.version?.toUpperCase() || 'V3'}
              </span>
              <span className="px-1.5 py-0.5 bg-blue-500/20 text-blue-300 rounded text-xs">
                ⚡
              </span>
              <span className="px-1.5 py-0.5 bg-primary/10 text-primary rounded text-xs">
                {feePercent}%
              </span>
              <span
                className={cn(
                  'px-2 py-0.5 text-xs rounded-full font-medium',
                  inRange
                    ? 'bg-success/10 text-success'
                    : 'bg-danger/10 text-danger'
                )}
              >
                {inRange ? '● In range' : '● Out of Range'}
              </span>
            </div>
          </div>
        </div>

        <a
          href={position.version === 'v4'
            ? `https://app.uniswap.org/positions/v4/${chainSlug[chainId] || 'ethereum'}/${position.tokenId}`
            : `https://app.uniswap.org/positions/v3/${chainSlug[chainId] || 'ethereum'}/${position.tokenId}`
          }
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-primary hover:text-primary/80 font-medium"
        >
          Details
        </a>
      </div>

      {/* Metrics Grid - Metrix Finance Style */}
      <div className="grid grid-cols-2 sm:grid-cols-7 gap-4 mb-4">
        <div>
          <p className="text-xs text-muted mb-1">Current Liquidity</p>
          <p className="font-semibold text-sm">
            ${formatNumber(totalValueUSD, 2)}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted mb-1">Earnings</p>
          <p className="font-semibold text-sm text-success">
            ${formatNumber(earnings, 2)}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted mb-1">Profit/Loss</p>
          <p className={cn(
            "font-semibold text-sm",
            profitLoss >= 0 ? "text-success" : "text-danger"
          )}>
            ${formatNumber(profitLoss, 2)}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted mb-1">VS HODL</p>
          <p className={cn(
            "font-semibold text-sm",
            vsHodl >= 0 ? "text-success" : "text-danger"
          )}>
            ${formatNumber(vsHodl, 2)}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted mb-1">APR</p>
          <p className="font-semibold text-sm text-purple-400">
            {formatNumber(apr, 2)}%
          </p>
        </div>
        <div>
          <p className="text-xs text-muted mb-1">Opened</p>
          <p className="font-medium text-sm">
            {openedDate}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted mb-1">Price Range</p>
          <PriceRangeSlider
            tickLower={position.tickLower}
            tickUpper={position.tickUpper}
            currentTick={position.currentTick}
            inRange={inRange}
            token0Decimals={token0Decimals}
            token1Decimals={token1Decimals}
            token0Symbol={token0Symbol}
            token1Symbol={token1Symbol}
            token0Price={token0Price}
            token1Price={token1Price}
          />
        </div>
      </div>
    </Card>
  );
}
