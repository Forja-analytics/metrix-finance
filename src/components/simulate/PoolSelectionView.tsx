'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { TokenIcon, TokenPairIcon } from '@/components/ui/TokenIcon';
import { MarketMetrics } from '@/components/dashboard/MarketMetrics';
import { POPULAR_TOKENS, EXCHANGES, NETWORKS } from '@/lib/constants';
import { fetchPools, fetchMarketData } from '@/lib/api';
import { formatCurrency, formatPercent, cn } from '@/lib/utils';
import { Pool, MarketData } from '@/types';
import {
  ChevronDown,
  Search,
  Loader2,
  Droplets,
  Layers,
  AlertCircle,
  Wallet,
  Hammer,
} from 'lucide-react';

// ---------- types ----------

interface SimpleToken {
  symbol: string;
  name: string;
  address: string;
}

interface PoolSelectionViewProps {
  onPoolSelect: (pool: Pool) => void;
}

// ---------- main component ----------

export default function PoolSelectionView({ onPoolSelect }: PoolSelectionViewProps) {
  // header state
  const [viewMode, setViewMode] = useState<'pair' | 'build'>('pair');
  const [searchTab, setSearchTab] = useState<'pair' | 'address'>('pair');

  // selection state
  const [selectedExchange, setSelectedExchange] = useState(EXCHANGES[0]);
  const [selectedNetwork, setSelectedNetwork] = useState(EXCHANGES[0].networks[0]);
  const [token0, setToken0] = useState<SimpleToken | null>(null);
  const [token1, setToken1] = useState<SimpleToken | null>(null);

  // data state
  const [pools, setPools] = useState<Pool[]>([]);
  const [loadingPools, setLoadingPools] = useState(false);
  const [marketData, setMarketData] = useState<MarketData | null>(null);
  const [addressSearch, setAddressSearch] = useState('');

  // fetch market data on mount
  useEffect(() => {
    fetchMarketData().then(setMarketData).catch(console.error);
  }, []);

  // fetch pools when both tokens selected
  const fetchPoolsForPair = useCallback(async () => {
    if (!token0 || !token1) {
      setPools([]);
      return;
    }
    setLoadingPools(true);
    try {
      const results = await fetchPools(
        selectedExchange.id,
        selectedNetwork.id,
        token0.symbol,
        token1.symbol,
        { first: 20, orderBy: 'totalValueLockedUSD', orderDirection: 'desc' }
      );
      setPools(results);
    } catch (err) {
      console.error('Error fetching pools:', err);
      setPools([]);
    } finally {
      setLoadingPools(false);
    }
  }, [token0, token1, selectedExchange.id, selectedNetwork.id]);

  useEffect(() => {
    fetchPoolsForPair();
  }, [fetchPoolsForPair]);

  // When exchange changes, reset network to first available
  const handleExchangeChange = (exchangeId: string) => {
    const ex = EXCHANGES.find((e) => e.id === exchangeId);
    if (ex) {
      setSelectedExchange(ex);
      setSelectedNetwork(ex.networks[0]);
    }
  };

  return (
    <div className="space-y-6">
      {/* ---- Header Row ---- */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold tracking-tight">Simulate</h1>
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium border border-primary/20">
            <Droplets className="w-3.5 h-3.5" />
            Liquidity Pools
          </span>
        </div>
        <div className="flex items-center gap-1 bg-card border border-border rounded-lg p-0.5">
          <button
            onClick={() => setViewMode('pair')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
              viewMode === 'pair'
                ? 'bg-primary text-white'
                : 'text-muted hover:text-foreground'
            )}
          >
            <Layers className="w-3.5 h-3.5" />
            Pair
          </button>
          <button
            onClick={() => setViewMode('build')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
              viewMode === 'build'
                ? 'bg-primary text-white'
                : 'text-muted hover:text-foreground'
            )}
          >
            <Hammer className="w-3.5 h-3.5" />
            Build
          </button>
        </div>
      </div>

      {/* ---- Market Metrics (4 cards) ---- */}
      {marketData && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <SimMetricCard
            label="DeFi Market Cap"
            value={formatCurrency(marketData.defiMarketCap, true)}
            change={marketData.defiMarketCapChange}
          />
          <SimMetricCard
            label="DeFi Volume (24h)"
            value={formatCurrency(marketData.defiVolume24h, true)}
            change={marketData.defiVolumeChange}
          />
          <FearGreedMini value={marketData.fearGreedIndex} />
          <AltcoinMini value={marketData.altcoinSeasonIndex} />
        </div>
      )}

      {/* ---- Two-Column Layout ---- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Pool Selection */}
        <Card className="p-0 overflow-hidden">
          <div className="border-b border-border px-5 pt-4 pb-0">
            <h2 className="text-lg font-semibold mb-3">Pool Selection</h2>
            <div className="flex gap-1">
              <button
                onClick={() => setSearchTab('pair')}
                className={cn(
                  'px-4 py-2 text-sm font-medium rounded-t-lg transition-colors border-b-2',
                  searchTab === 'pair'
                    ? 'border-primary text-primary bg-primary/5'
                    : 'border-transparent text-muted hover:text-foreground'
                )}
              >
                Pair
              </button>
              <button
                onClick={() => setSearchTab('address')}
                className={cn(
                  'px-4 py-2 text-sm font-medium rounded-t-lg transition-colors border-b-2',
                  searchTab === 'address'
                    ? 'border-primary text-primary bg-primary/5'
                    : 'border-transparent text-muted hover:text-foreground'
                )}
              >
                Address
              </button>
            </div>
          </div>

          <div className="p-5 space-y-4">
            {searchTab === 'pair' ? (
              <>
                {/* Exchange Dropdown */}
                <div>
                  <label className="block text-xs text-muted mb-1.5">Exchange</label>
                  <Dropdown
                    value={selectedExchange.id}
                    onChange={handleExchangeChange}
                    options={EXCHANGES.map((ex) => ({
                      value: ex.id,
                      label: ex.name,
                      logo: ex.logo,
                    }))}
                  />
                </div>

                {/* Network Dropdown */}
                <div>
                  <label className="block text-xs text-muted mb-1.5">Network</label>
                  <Dropdown
                    value={selectedNetwork.id}
                    onChange={(id) => {
                      const net = selectedExchange.networks.find((n) => n.id === id);
                      if (net) setSelectedNetwork(net);
                    }}
                    options={selectedExchange.networks.map((net) => ({
                      value: net.id,
                      label: net.name,
                      logo: net.logo,
                    }))}
                  />
                </div>

                {/* Token Selectors */}
                <div className="flex items-start gap-3">
                  <div className="flex-1">
                    <label className="block text-xs text-muted mb-1.5">Token 1</label>
                    <TokenSelect
                      value={token0}
                      onChange={setToken0}
                      excludeToken={token1}
                      placeholder="Select a token"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs text-muted mb-1.5">Token 2</label>
                    <TokenSelect
                      value={token1}
                      onChange={setToken1}
                      excludeToken={token0}
                      placeholder="Select a token"
                    />
                  </div>
                </div>
              </>
            ) : (
              /* Address search */
              <div>
                <label className="block text-xs text-muted mb-1.5">Pool Address</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                  <input
                    type="text"
                    value={addressSearch}
                    onChange={(e) => setAddressSearch(e.target.value)}
                    placeholder="0x..."
                    className="w-full pl-9 pr-3 py-2.5 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Right: Pools List */}
        <Card className="p-0 overflow-hidden">
          <div className="border-b border-border px-5 py-4">
            <h2 className="text-lg font-semibold">Pools</h2>
          </div>

          <div className="p-5">
            {!token0 || !token1 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Wallet className="w-10 h-10 text-muted mb-3" />
                <p className="text-sm text-muted">Select a valid pair to list pools.</p>
              </div>
            ) : loadingPools ? (
              <div className="flex flex-col items-center justify-center py-16">
                <Loader2 className="w-8 h-8 text-primary animate-spin mb-3" />
                <p className="text-sm text-muted">Searching pools...</p>
              </div>
            ) : pools.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <AlertCircle className="w-10 h-10 text-muted mb-3" />
                <p className="text-sm text-muted">
                  No pools found for {token0.symbol}/{token1.symbol} on{' '}
                  {selectedExchange.name} ({selectedNetwork.name}).
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                {pools.map((pool) => (
                  <button
                    key={pool.id}
                    onClick={() => onPoolSelect(pool)}
                    className="w-full text-left p-3 rounded-lg border border-border bg-background hover:border-primary/40 hover:bg-card-hover transition-all group"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <TokenPairIcon
                          token0Symbol={pool.token0.symbol}
                          token1Symbol={pool.token1.symbol}
                          size="sm"
                        />
                        <span className="font-medium text-sm">
                          {pool.token0.symbol}/{pool.token1.symbol}
                        </span>
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                          {(pool.feeTier / 10000).toFixed(2)}%
                        </span>
                      </div>
                      <ChevronDown className="w-4 h-4 text-muted -rotate-90 group-hover:text-primary transition-colors" />
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <span className="text-muted block">TVL</span>
                        <span className="font-medium">{formatCurrency(pool.tvl, true)}</span>
                      </div>
                      <div>
                        <span className="text-muted block">APR</span>
                        <span className="font-medium text-success">
                          {formatPercent(pool.apr)}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted block">24h Vol</span>
                        <span className="font-medium">
                          {formatCurrency(pool.volume24h, true)}
                        </span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

// ---------- sub-components ----------

/** Generic dropdown with logo support */
function Dropdown({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (val: string) => void;
  options: { value: string; label: string; logo?: string }[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selected = options.find((o) => o.value === value);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          'flex items-center justify-between w-full px-3 py-2.5 text-sm bg-background border border-border rounded-lg',
          'hover:border-primary/50 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50'
        )}
      >
        <div className="flex items-center gap-2">
          {selected?.logo && (
            <img src={selected.logo} alt="" className="w-5 h-5 rounded-full" />
          )}
          <span className="font-medium">{selected?.label ?? 'Select'}</span>
        </div>
        <ChevronDown className={cn('w-4 h-4 text-muted transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-lg shadow-xl overflow-hidden">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
              className={cn(
                'flex items-center gap-2 w-full px-3 py-2.5 text-sm text-left hover:bg-card-hover transition-colors',
                opt.value === value && 'bg-primary/10'
              )}
            >
              {opt.logo && <img src={opt.logo} alt="" className="w-5 h-5 rounded-full" />}
              <span className="font-medium">{opt.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Token selector dropdown with search */
function TokenSelect({
  value,
  onChange,
  excludeToken,
  placeholder,
}: {
  value: SimpleToken | null;
  onChange: (token: SimpleToken | null) => void;
  excludeToken: SimpleToken | null;
  placeholder: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearch('');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredTokens = POPULAR_TOKENS.filter(
    (t) =>
      t.address !== excludeToken?.address &&
      (t.symbol.toLowerCase().includes(search.toLowerCase()) ||
        t.name.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex items-center justify-between w-full px-3 py-2.5 text-sm bg-background border border-border rounded-lg',
          'hover:border-primary/50 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50'
        )}
      >
        {value ? (
          <div className="flex items-center gap-2">
            <TokenIcon symbol={value.symbol} size="sm" />
            <span className="font-medium">
              {value.name}{' '}
              <span className="text-muted">({value.symbol})</span>
            </span>
          </div>
        ) : (
          <span className="text-muted">{placeholder}</span>
        )}
        <ChevronDown className={cn('w-4 h-4 text-muted transition-transform', isOpen && 'rotate-180')} />
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-lg shadow-xl overflow-hidden">
          <div className="p-2 border-b border-border">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search tokens..."
                className="w-full pl-9 pr-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                autoFocus
              />
            </div>
          </div>
          <div className="max-h-56 overflow-y-auto">
            {filteredTokens.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted">No tokens found</div>
            ) : (
              filteredTokens.map((token) => (
                <button
                  key={token.address}
                  type="button"
                  onClick={() => {
                    onChange(token);
                    setIsOpen(false);
                    setSearch('');
                  }}
                  className={cn(
                    'flex items-center gap-3 w-full px-3 py-2.5 text-left hover:bg-card-hover transition-colors',
                    value?.address === token.address && 'bg-primary/10'
                  )}
                >
                  <TokenIcon symbol={token.symbol} size="md" />
                  <div>
                    <span className="font-medium">{token.name}</span>
                    <span className="text-xs text-muted block">{token.symbol}</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** Compact metric card for the 4-card row */
function SimMetricCard({
  label,
  value,
  change,
}: {
  label: string;
  value: string;
  change?: number;
}) {
  const isPositive = change !== undefined && change > 0;
  const isNegative = change !== undefined && change < 0;

  return (
    <Card className="p-3">
      <span className="text-xs text-muted">{label}</span>
      <div className="flex items-end justify-between mt-1">
        <span className="text-lg font-semibold">{value}</span>
        {change !== undefined && (
          <span
            className={cn(
              'text-xs font-medium',
              isPositive ? 'text-success' : isNegative ? 'text-danger' : 'text-muted'
            )}
          >
            {formatPercent(change)}
          </span>
        )}
      </div>
    </Card>
  );
}

/** Compact Fear & Greed card */
function FearGreedMini({ value }: { value: number }) {
  const color =
    value <= 25
      ? '#ef4444'
      : value <= 45
        ? '#f97316'
        : value <= 55
          ? '#eab308'
          : value <= 75
            ? '#84cc16'
            : '#22c55e';

  const label =
    value <= 25
      ? 'Extreme Fear'
      : value <= 45
        ? 'Fear'
        : value <= 55
          ? 'Neutral'
          : value <= 75
            ? 'Greed'
            : 'Extreme Greed';

  return (
    <Card className="p-3">
      <span className="text-xs text-muted">Fear & Greed Index</span>
      <div className="flex items-center justify-between mt-1">
        <span className="text-lg font-semibold">{value}</span>
        <span
          className="text-xs font-medium px-2 py-0.5 rounded-full"
          style={{ backgroundColor: `${color}20`, color }}
        >
          {label}
        </span>
      </div>
      <div className="mt-2 h-1.5 bg-background rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${value}%`, backgroundColor: color }}
        />
      </div>
    </Card>
  );
}

/** Compact Altcoin Season card */
function AltcoinMini({ value }: { value: number }) {
  const isBtc = value < 50;
  const label = isBtc ? 'Bitcoin Season' : 'Altcoin Season';
  const color = isBtc ? '#f7931a' : '#627eea';

  return (
    <Card className="p-3">
      <span className="text-xs text-muted">Altcoin Season Index</span>
      <div className="flex items-center justify-between mt-1">
        <span className="text-lg font-semibold">{value}</span>
        <span
          className="text-xs font-medium px-2 py-0.5 rounded-full"
          style={{ backgroundColor: `${color}20`, color }}
        >
          {label}
        </span>
      </div>
      <div className="mt-2 h-1.5 bg-background rounded-full overflow-hidden">
        <div
          className="h-full transition-all duration-500"
          style={{
            width: `${value}%`,
            background: 'linear-gradient(90deg, #f7931a 0%, #627eea 100%)',
          }}
        />
      </div>
    </Card>
  );
}
