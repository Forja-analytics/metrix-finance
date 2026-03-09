'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { PositionCard } from '@/components/track/PositionCard';
import { AddPositionModal } from '@/components/track/AddPositionModal';
import { WalletPositionCard } from '@/components/track/WalletPositionCard';
import { V4PositionLookup } from '@/components/track/V4PositionLookup';
import { useStore } from '@/lib/store';
import { usePositions } from '@/hooks/usePositions';
import { useTranslation } from '@/hooks/useTranslation';
import { Position } from '@/types';
import { Plus, Wallet, TrendingUp, DollarSign, PieChart, RefreshCw, Link2, Search, ChevronDown, Calendar, Bell, X } from 'lucide-react';
import { formatCurrency, formatPercent } from '@/lib/utils';
import { fetchTokenPrices } from '@/lib/api';
import { fetchPositionsHistory, PositionHistory } from '@/lib/uniswap-subgraph';
import { fetchV4PositionsHistory, V4PositionHistory } from '@/lib/v4-subgraph';

export default function TrackPage() {
  const t = useTranslation();
  const { address, isConnected } = useAccount();
  const { positions: walletPositions, isLoading: isLoadingWallet, refetch, positionCount } = usePositions();
  const { trackedPositions, addTrackedPosition, removeTrackedPosition } = useStore();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'wallet' | 'v4lookup' | 'manual'>('wallet');
  const [positionFilter, setPositionFilter] = useState<'opened' | 'closed' | 'all'>('opened');
  const [searchQuery, setSearchQuery] = useState('');
  const [networkFilter, setNetworkFilter] = useState<string>('all');
  const [exchangeFilter, setExchangeFilter] = useState<string>('all');
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [positionHistories, setPositionHistories] = useState<Map<string, PositionHistory>>(new Map());
  const [v4PositionHistories, setV4PositionHistories] = useState<Map<string, V4PositionHistory>>(new Map());

  // Fetch token prices periodically
  useEffect(() => {
    fetchTokenPrices().then(setPrices);
    // Refresh prices every 60 seconds
    const interval = setInterval(() => {
      fetchTokenPrices().then(setPrices);
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // Fetch position histories when wallet positions change
  // V3 positions use The Graph subgraph, V4 positions use Etherscan
  useEffect(() => {
    if (walletPositions.length === 0 || !address) return;

    // Separate V3 and V4 positions
    const v3Positions = walletPositions.filter(pos => pos.version !== 'v4');
    const v4Positions = walletPositions.filter(pos => pos.version === 'v4');

    // Fetch V3 histories from The Graph
    const fetchV3Histories = async () => {
      if (v3Positions.length === 0) {
        setPositionHistories(new Map());
        return;
      }

      // Group V3 positions by chain for batch fetching
      const positionsByChain = new Map<number, string[]>();
      v3Positions.forEach(pos => {
        const chainId = pos.chainId || 1;
        if (!positionsByChain.has(chainId)) {
          positionsByChain.set(chainId, []);
        }
        positionsByChain.get(chainId)!.push(pos.tokenId.toString());
      });

      const allHistories = new Map<string, PositionHistory>();
      for (const [chainId, tokenIds] of positionsByChain) {
        const histories = await fetchPositionsHistory(tokenIds, chainId);
        histories.forEach((history, tokenId) => {
          allHistories.set(tokenId, history);
        });
      }
      setPositionHistories(allHistories);
    };

    // Fetch V4 histories from V4 subgraph (ModifyLiquidity events)
    const fetchV4Histories = async () => {
      if (v4Positions.length === 0) {
        setV4PositionHistories(new Map());
        return;
      }

      const tokenIds = v4Positions.map(pos => pos.tokenId.toString());
      // Pass positions with tick ranges for matching ModifyLiquidity events
      const positionsWithTicks = v4Positions.map(pos => ({
        tokenId: pos.tokenId.toString(),
        tickLower: pos.tickLower,
        tickUpper: pos.tickUpper,
      }));
      const histories = await fetchV4PositionsHistory(tokenIds, address, positionsWithTicks);
      setV4PositionHistories(histories);
    };

    // Fetch both in parallel
    Promise.all([fetchV3Histories(), fetchV4Histories()]);
  }, [walletPositions, address]);

  const handleAddPosition = (position: Position) => {
    addTrackedPosition(position);
  };

  // Calculate wallet positions value and fees (V3 + V4)
  const walletPositionsTotals = useMemo(() => {
    let totalValue = 0;
    let totalOriginalInvestment = 0; // Historical USD value at deposit time (for P&L)
    let totalUnclaimedFees = 0;
    let totalClaimedFees = 0;
    let v3Count = 0;
    let v4Count = 0;
    let oldestPositionTimestamp = Date.now();
    let totalPositionAgeDays = 0;
    let totalHodlValue = 0; // Deposits valued at current prices (for HODL/IL calc)

    walletPositions.forEach(pos => {
      const token0Symbol = pos.token0Symbol || 'ETH';
      const token1Symbol = pos.token1Symbol || '';
      const token0Price = prices[token0Symbol] || prices['ETH'] || 0;
      const token1Price = prices[token1Symbol] || 0;

      const token0Amount = pos.token0Amount || 0;
      const token1Amount = pos.token1Amount || 0;

      const positionValue = (token0Amount * token0Price) + (token1Amount * token1Price);
      totalValue += positionValue;

      // Count position types
      if (pos.version === 'v4') {
        v4Count++;
      } else {
        v3Count++;
      }

      // Use pre-calculated uncollected fees (works for both V3 and V4)
      const uncollectedFees0 = pos.uncollectedFees0 || 0;
      const uncollectedFees1 = pos.uncollectedFees1 || 0;
      totalUnclaimedFees += (uncollectedFees0 * token0Price) + (uncollectedFees1 * token1Price);

      // Get historical data - use V3 subgraph for V3, V4 subgraph for V4
      const isV4 = pos.version === 'v4';
      const v3History = positionHistories.get(pos.tokenId.toString());
      const v4History = v4PositionHistories.get(pos.tokenId.toString());

      if (isV4 && v4History) {
        // V4 position with history from V4 subgraph (ModifyLiquidity events)
        const hasDepositData = v4History.depositedToken0 > 0 || v4History.depositedToken1 > 0;
        if (hasDepositData) {
          // HODL value = deposits at current prices
          const depositsAtCurrentPrices = (v4History.depositedToken0 * token0Price) + (v4History.depositedToken1 * token1Price);

          // Use historical USD value if available, otherwise use deposits at current prices
          let originalInvestment = v4History.depositedUSD > 0
            ? v4History.depositedUSD
            : depositsAtCurrentPrices;

          // Safety: if calculated value is unreasonably small, use current position value
          // Original investment shouldn't be less than 10% of current value in most cases
          const minReasonable = Math.max(1, positionValue * 0.1);
          if (originalInvestment < minReasonable) {
            originalInvestment = positionValue > 0 ? positionValue : 1;
          }

          totalOriginalInvestment += originalInvestment;
          totalHodlValue += depositsAtCurrentPrices > 0 ? depositsAtCurrentPrices : positionValue;

          // Add claimed fees from V4 subgraph
          totalClaimedFees += (v4History.claimedToken0 * token0Price) + (v4History.claimedToken1 * token1Price);
        } else {
          // Fallback to current value if no deposit data
          totalOriginalInvestment += positionValue > 0 ? positionValue : 0;
          totalHodlValue += positionValue > 0 ? positionValue : 0;
        }

        // Track position age from mint transaction
        // Validate timestamp is valid (positive and in the past)
        const now = Date.now();
        const validTimestamp = v4History.createdTimestamp > 0 && v4History.createdTimestamp < now
          ? v4History.createdTimestamp
          : null;

        if (validTimestamp && validTimestamp < oldestPositionTimestamp) {
          oldestPositionTimestamp = validTimestamp;
        }

        // Calculate position age, with minimum 1 day per position to prevent APR inflation
        const rawAgeDays = validTimestamp
          ? (now - validTimestamp) / (1000 * 60 * 60 * 24)
          : 30; // Default to 30 days if no valid timestamp
        const positionAgeDays = Math.max(1, rawAgeDays); // Minimum 1 day per position
        totalPositionAgeDays += positionAgeDays;
      } else if (!isV4 && v3History) {
        // V3 position with history from The Graph
        // HODL value = deposits at current prices
        const depositsAtCurrentPrices = (v3History.depositedToken0 * token0Price) + (v3History.depositedToken1 * token1Price);

        // Use historical USD value if available, otherwise use deposits at current prices
        let originalInvestment = v3History.depositedUSD > 0
          ? v3History.depositedUSD
          : depositsAtCurrentPrices;

        // Safety: if calculated value is unreasonably small, use current position value
        // Original investment shouldn't be less than 10% of current value in most cases
        const minReasonable = Math.max(1, positionValue * 0.1);
        if (originalInvestment < minReasonable) {
          originalInvestment = positionValue > 0 ? positionValue : 1;
        }

        totalOriginalInvestment += originalInvestment;
        totalHodlValue += depositsAtCurrentPrices > 0 ? depositsAtCurrentPrices : positionValue;

        // Claimed fees
        totalClaimedFees += (v3History.claimedFees0 * token0Price) + (v3History.claimedFees1 * token1Price);

        // Track position age - validate timestamp is valid
        const now = Date.now();
        const validTimestamp = v3History.createdTimestamp > 0 && v3History.createdTimestamp < now
          ? v3History.createdTimestamp
          : null;

        if (validTimestamp && validTimestamp < oldestPositionTimestamp) {
          oldestPositionTimestamp = validTimestamp;
        }

        // Calculate position age, with minimum 1 day per position to prevent APR inflation
        const rawAgeDays = validTimestamp
          ? (now - validTimestamp) / (1000 * 60 * 60 * 24)
          : 30; // Default to 30 days if no valid timestamp
        const positionAgeDays = Math.max(1, rawAgeDays); // Minimum 1 day per position
        totalPositionAgeDays += positionAgeDays;
      } else {
        // No history available - estimate deposits as current value
        totalOriginalInvestment += positionValue;
        totalHodlValue += positionValue;
      }
    });

    const avgPositionAgeDays = walletPositions.length > 0 && totalPositionAgeDays > 0
      ? totalPositionAgeDays / walletPositions.length
      : 30;

    return {
      totalValue,
      totalOriginalInvestment,
      totalUnclaimedFees,
      totalClaimedFees,
      totalHodlValue,
      v3Count,
      v4Count,
      oldestPositionTimestamp,
      avgPositionAgeDays,
    };
  }, [walletPositions, prices, positionHistories, v4PositionHistories]);

  // Manual positions totals
  const manualTotalValue = trackedPositions.reduce((acc, p) => acc + p.currentValueUSD, 0);
  const manualTotalFees = trackedPositions.reduce((acc, p) => acc + p.feesEarnedUSD, 0);
  const manualTotalDeposits = trackedPositions.reduce((acc, p) => acc + (p.depositedUSD || p.currentValueUSD), 0);

  // Combined totals
  const totalValue = walletPositionsTotals.totalValue + manualTotalValue;
  const totalOriginalInvestment = walletPositionsTotals.totalOriginalInvestment + manualTotalDeposits;
  const totalHodlValue = walletPositionsTotals.totalHodlValue + manualTotalDeposits;

  // Earnings breakdown with real claimed fees from The Graph
  const unclaimedFees = walletPositionsTotals.totalUnclaimedFees + manualTotalFees;
  const claimedFees = walletPositionsTotals.totalClaimedFees;
  const totalEarnings = unclaimedFees + claimedFees;

  // Retention rate: percentage of earnings that are still unclaimed
  const retentionRate = totalEarnings > 0 ? ((unclaimedFees / totalEarnings) * 100) : 0;

  // Profit/Loss = Total Current Value (position + all fees) - Original Investment
  // This is the actual capital gain/loss
  const totalCurrentValue = totalValue + totalEarnings;
  const profitLoss = totalCurrentValue - totalOriginalInvestment;

  // Asset Gain = Position Value Change (not including fees)
  const assetGain = totalValue - totalOriginalInvestment;

  // VS HODL: How much better/worse LP is compared to just holding
  // HODL Value = Original deposits valued at current prices
  // Impermanent Loss = HODL Value - Current Position Value (not including fees)
  const impermanentLoss = totalHodlValue - totalValue;
  // VS HODL = Earnings - Impermanent Loss
  const vsHodl = totalEarnings - Math.max(0, impermanentLoss);

  // Use the HIGHER of calculated investment OR current value for safe APR calculation
  const safeOriginalInvestment = Math.max(totalOriginalInvestment, totalValue, 1);

  // ROI: Total profit relative to initial investment
  const roi = safeOriginalInvestment > 0 ? (profitLoss / safeOriginalInvestment) * 100 : 0;

  // APR calculation: (earnings / days) * 365 / investment * 100
  // Use current liquidity as the base for yield rate APR (how much you're earning on what you have)
  // This gives a clearer picture of current yield rate
  const avgPositionAgeDays = Math.max(1, walletPositionsTotals.avgPositionAgeDays || 30);

  // Use current liquidity value for APR denominator (yield rate on current capital)
  const aprBase = Math.max(totalValue, 1);
  const rawApr = ((totalEarnings / avgPositionAgeDays) * 365 / aprBase) * 100;
  // Cap APR at reasonable maximum (10,000%) to prevent display of absurd values from edge cases
  const apr = Math.min(rawApr, 10000);

  // Debug logging
  console.log('[Track Page] Portfolio APR Calculation:', {
    totalValue,
    totalOriginalInvestment,
    aprBase,
    totalEarnings,
    avgPositionAgeDays,
    rawApr,
    cappedApr: apr,
    positionCount: walletPositions.length,
  });

  // Projections based on APR applied to current liquidity
  // This projects future earnings based on current yield rate and current capital
  const dailyYieldRate = apr / 100 / 365; // Daily yield as a decimal
  const projection24h = totalValue * dailyYieldRate;
  const projection7d = totalValue * dailyYieldRate * 7;
  const projection30d = totalValue * dailyYieldRate * 30;

  // Filter positions based on search and filters
  const filteredPositions = useMemo(() => {
    return walletPositions.filter(pos => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch =
          (pos.token0Symbol?.toLowerCase().includes(query)) ||
          (pos.token1Symbol?.toLowerCase().includes(query)) ||
          pos.tokenId.toString().includes(query);
        if (!matchesSearch) return false;
      }

      // Network filter
      if (networkFilter !== 'all' && pos.chainName?.toLowerCase() !== networkFilter.toLowerCase()) {
        return false;
      }

      // Exchange filter (V3/V4)
      if (exchangeFilter !== 'all') {
        if (exchangeFilter === 'v3' && pos.version !== 'v3') return false;
        if (exchangeFilter === 'v4' && pos.version !== 'v4') return false;
      }

      // Position filter (opened = has liquidity, closed = no liquidity)
      if (positionFilter === 'opened' && Number(pos.liquidity) === 0) return false;
      if (positionFilter === 'closed' && Number(pos.liquidity) > 0) return false;

      return true;
    });
  }, [walletPositions, searchQuery, networkFilter, exchangeFilter, positionFilter]);

  // Debug: Log filtered positions
  console.log('[Track Page] Positions filter:', {
    totalPositions: walletPositions.length,
    filteredPositions: filteredPositions.length,
    positionFilter,
    positions: filteredPositions.map(p => ({ id: p.tokenId.toString(), liquidity: p.liquidity.toString() })),
  });

  // Get unique networks for filter dropdown
  const uniqueNetworks = useMemo(() => {
    const networks = new Set(walletPositions.map(p => p.chainName || 'Unknown'));
    return Array.from(networks);
  }, [walletPositions]);

  const resetFilters = () => {
    setSearchQuery('');
    setNetworkFilter('all');
    setExchangeFilter('all');
    setPositionFilter('opened');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">{t('track')}</h1>
          <p className="text-muted mt-1">
            {t('trackSubtitle')}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <ConnectButton
            showBalance={false}
            chainStatus="icon"
            accountStatus={{
              smallScreen: 'avatar',
              largeScreen: 'full',
            }}
          />
        </div>
      </div>

      {/* Wallet Connection Card */}
      {!isConnected ? (
        <Card className="p-8 mb-6">
          <div className="flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Wallet className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Connect Your Wallet</h3>
            <p className="text-muted mb-6 max-w-md">
              Connect your wallet to automatically detect and track all your Uniswap V3 liquidity positions across multiple chains.
            </p>
            <ConnectButton />
          </div>
        </Card>
      ) : (
        <>
          {/* Connected Wallet Info */}
          <Card className="p-4 mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-success/10 flex items-center justify-center">
                  <Link2 className="w-5 h-5 text-success" />
                </div>
                <div>
                  <p className="text-sm text-muted">Connected Wallet</p>
                  <p className="font-mono text-sm">
                    {address?.slice(0, 6)}...{address?.slice(-4)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-sm text-muted">Positions Found</p>
                  <p className="font-medium">{positionCount}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refetch()}
                  disabled={isLoadingWallet}
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${isLoadingWallet ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>
            </div>
          </Card>

          {/* Tabs */}
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setActiveTab('wallet')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'wallet'
                  ? 'bg-primary text-white'
                  : 'bg-card hover:bg-card-hover text-muted'
              }`}
            >
              <Wallet className="w-4 h-4 inline mr-2" />
              Wallet Positions ({walletPositions.length})
            </button>
            <button
              onClick={() => setActiveTab('v4lookup')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'v4lookup'
                  ? 'bg-primary text-white'
                  : 'bg-card hover:bg-card-hover text-muted'
              }`}
            >
              <Search className="w-4 h-4 inline mr-2" />
              V4 Lookup
            </button>
            <button
              onClick={() => setActiveTab('manual')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'manual'
                  ? 'bg-primary text-white'
                  : 'bg-card hover:bg-card-hover text-muted'
              }`}
            >
              <Plus className="w-4 h-4 inline mr-2" />
              Manual Tracking ({trackedPositions.length})
            </button>
          </div>
        </>
      )}

      {/* Summary Cards - Metrix Finance Style */}
      {(trackedPositions.length > 0 || walletPositions.length > 0) && isConnected && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          {/* Current Liquidity */}
          <Card className="p-4">
            <p className="text-sm text-muted mb-2">Current Liquidity</p>
            <p className="text-2xl font-bold">{formatCurrency(totalValue)}</p>
            <div className="flex gap-6 mt-3 text-xs">
              <div>
                <p className="text-muted">Deposits</p>
                <p className="font-medium">{formatCurrency(totalOriginalInvestment)}</p>
              </div>
              <div>
                <p className="text-muted">Withdrawals</p>
                <p className="font-medium">$0.00</p>
              </div>
            </div>
          </Card>

          {/* Earnings */}
          <Card className="p-4 border-l-2 border-l-primary">
            <p className="text-sm text-muted mb-2">Earnings</p>
            <p className="text-2xl font-bold text-success">{formatCurrency(totalEarnings)}</p>
            <div className="flex gap-4 mt-3 text-xs">
              <div>
                <p className="text-muted">Unclaimed</p>
                <p className="font-medium text-yellow-400">{formatCurrency(unclaimedFees)}</p>
              </div>
              <div>
                <p className="text-muted">Claimed</p>
                <p className="font-medium">{formatCurrency(claimedFees)}</p>
              </div>
              <div>
                <p className="text-muted">Retention</p>
                <p className="font-medium text-success">{formatPercent(retentionRate)}</p>
              </div>
            </div>
          </Card>

          {/* Profit/Loss */}
          <Card className="p-4 border-l-2 border-l-success">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-muted">Profit/Loss</p>
              <label className="flex items-center gap-1 text-xs text-muted cursor-pointer">
                <input type="checkbox" className="w-3 h-3 rounded" />
                TXN Fee
              </label>
            </div>
            <p className="text-2xl font-bold text-success">{formatCurrency(profitLoss)}</p>
            <div className="flex gap-4 mt-3 text-xs">
              <div>
                <p className="text-muted">VS HODL</p>
                <p className="font-medium text-success">{formatCurrency(vsHodl)}</p>
              </div>
              <div>
                <p className="text-muted">Asset Gain</p>
                <p className="font-medium text-success">{formatCurrency(assetGain)}</p>
              </div>
              <div>
                <p className="text-muted">ROI</p>
                <p className="font-medium text-success">{formatPercent(roi)}</p>
              </div>
            </div>
          </Card>

          {/* APR */}
          <Card className="p-4 border-l-2 border-l-purple-500">
            <p className="text-sm text-muted mb-2">APR</p>
            <p className="text-2xl font-bold text-purple-400">{formatPercent(apr)}</p>
            <div className="flex gap-4 mt-3 text-xs">
              <div>
                <p className="text-muted">24H Projection</p>
                <p className="font-medium">{formatCurrency(projection24h)}</p>
              </div>
              <div>
                <p className="text-muted">7d Projection</p>
                <p className="font-medium">{formatCurrency(projection7d)}</p>
              </div>
              <div>
                <p className="text-muted">30d Projection</p>
                <p className="font-medium">{formatCurrency(projection30d)}</p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Positions Content */}
      {isConnected && activeTab === 'wallet' && (
        <div>
          {/* Position Filter Tabs - Opened/Closed/All */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <div className="flex border-b-2 border-transparent">
                <button
                  onClick={() => setPositionFilter('opened')}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                    positionFilter === 'opened'
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted hover:text-foreground'
                  }`}
                >
                  Opened Positions
                </button>
                <button
                  onClick={() => setPositionFilter('closed')}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                    positionFilter === 'closed'
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted hover:text-foreground'
                  }`}
                >
                  Closed Positions
                </button>
                <button
                  onClick={() => setPositionFilter('all')}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                    positionFilter === 'all'
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted hover:text-foreground'
                  }`}
                >
                  All Positions
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setIsAddModalOpen(true)}>
                <Plus className="w-4 h-4 mr-1" />
                Add Position
              </Button>
              <Button variant="ghost" size="sm" className="text-primary">
                <Bell className="w-4 h-4 mr-1" />
                View Alerts
              </Button>
            </div>
          </div>

          {/* Search and Filter Controls */}
          <div className="flex flex-wrap items-center gap-3 mb-4">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px] max-w-[280px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-card border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            {/* Exchange Filter */}
            <div className="relative">
              <select
                value={exchangeFilter}
                onChange={(e) => setExchangeFilter(e.target.value)}
                className="appearance-none px-3 py-2 pr-8 bg-card border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
              >
                <option value="all">Exchange: All</option>
                <option value="v3">Uniswap V3</option>
                <option value="v4">Uniswap V4</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
            </div>

            {/* Network Filter */}
            <div className="relative">
              <select
                value={networkFilter}
                onChange={(e) => setNetworkFilter(e.target.value)}
                className="appearance-none px-3 py-2 pr-8 bg-card border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
              >
                <option value="all">Network: All</option>
                {uniqueNetworks.map(network => (
                  <option key={network} value={network.toLowerCase()}>{network}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
            </div>

            {/* Wallet Filter (placeholder) */}
            <div className="relative">
              <select
                className="appearance-none px-3 py-2 pr-8 bg-card border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
              >
                <option>Wallet: All</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
            </div>

            {/* Date Picker */}
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
              <input
                type="text"
                value={new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                readOnly
                className="pl-9 pr-3 py-2 bg-card border border-border rounded-lg text-sm focus:outline-none cursor-pointer w-[140px]"
              />
            </div>

            {/* Reset Filters */}
            <button
              onClick={resetFilters}
              className="text-sm text-primary hover:text-primary/80 font-medium"
            >
              Reset filters
            </button>
          </div>

          {isLoadingWallet ? (
            <Card className="p-12 text-center">
              <RefreshCw className="w-12 h-12 text-muted mx-auto mb-4 animate-spin" />
              <h3 className="text-lg font-medium mb-2">Loading Positions...</h3>
              <p className="text-muted">Fetching your liquidity positions from the blockchain</p>
            </Card>
          ) : filteredPositions.length === 0 ? (
            <Card className="p-12 text-center">
              <Wallet className="w-16 h-16 text-muted mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No Positions Found</h3>
              <p className="text-muted mb-6 max-w-md mx-auto">
                {walletPositions.length > 0
                  ? 'No positions match your current filters. Try adjusting your search criteria.'
                  : "We couldn't find any Uniswap positions in your wallet across all supported chains."}
              </p>
              {walletPositions.length > 0 ? (
                <Button variant="outline" onClick={resetFilters}>
                  <X className="w-4 h-4 mr-2" />
                  Clear Filters
                </Button>
              ) : (
                <Button onClick={() => setActiveTab('manual')}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Position Manually
                </Button>
              )}
            </Card>
          ) : (
            <div className="space-y-4">
              {filteredPositions.map((position) => (
                <WalletPositionCard
                  key={position.tokenId.toString()}
                  position={position}
                  prices={prices}
                  positionHistory={positionHistories.get(position.tokenId.toString())}
                  v4PositionHistory={v4PositionHistories.get(position.tokenId.toString())}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {isConnected && activeTab === 'v4lookup' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">V4 Position Lookup</h2>
            <span className="text-sm text-muted">Search positions by NFT ID</span>
          </div>
          <V4PositionLookup />
        </div>
      )}

      {isConnected && activeTab === 'manual' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Manually Tracked Positions</h2>
            <Button size="sm" onClick={() => setIsAddModalOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Position
            </Button>
          </div>

          {trackedPositions.length === 0 ? (
            <Card className="p-12 text-center">
              <Plus className="w-16 h-16 text-muted mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No Manual Positions</h3>
              <p className="text-muted mb-6 max-w-md mx-auto">
                Add positions manually to track pools that aren&apos;t automatically detected from your wallet.
              </p>
              <Button onClick={() => setIsAddModalOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add Position
              </Button>
            </Card>
          ) : (
            <div className="space-y-4">
              {trackedPositions.map((position) => (
                <PositionCard
                  key={position.id}
                  position={position}
                  onRemove={removeTrackedPosition}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Fallback for not connected */}
      {!isConnected && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Your Positions</h2>
            <Button size="sm" onClick={() => setIsAddModalOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Position
            </Button>
          </div>

          {trackedPositions.length === 0 ? (
            <Card className="p-12 text-center">
              <Wallet className="w-16 h-16 text-muted mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No Positions Tracked</h3>
              <p className="text-muted mb-6 max-w-md mx-auto">
                Connect your wallet to automatically detect positions, or add them manually.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <ConnectButton />
                <span className="text-muted">or</span>
                <Button variant="outline" onClick={() => setIsAddModalOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Manually
                </Button>
              </div>
            </Card>
          ) : (
            <div className="space-y-4">
              {trackedPositions.map((position) => (
                <PositionCard
                  key={position.id}
                  position={position}
                  onRemove={removeTrackedPosition}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add Position Modal */}
      <AddPositionModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAdd={handleAddPosition}
      />
    </div>
  );
}
