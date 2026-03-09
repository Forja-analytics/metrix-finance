'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { fetchPools } from '@/lib/api';
import { fetchProtocolStats } from '@/lib/uniswap-subgraph';
import { Pool } from '@/types';
import { useStore } from '@/lib/store';
import { useTranslation } from '@/hooks/useTranslation';
import {
  Search,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  TrendingUp,
  DollarSign,
  BarChart3,
  Layers,
  ExternalLink,
  Filter,
  ArrowUpDown,
} from 'lucide-react';
import { formatCurrency, formatNumber, cn } from '@/lib/utils';
import { TokenPairIcon } from '@/components/ui/TokenIcon';
import { NETWORKS } from '@/lib/constants';
import Link from 'next/link';

type SortField = 'tvl' | 'volume24h' | 'apr' | 'fees24h' | 'feeTier';
type SortDirection = 'asc' | 'desc';

const EXCHANGES = [
  { id: 'uniswap-v3', name: 'Uniswap V3', icon: '🦄' },
  { id: 'uniswap-v4', name: 'Uniswap V4', icon: '🦄' },
];

const FEE_TIERS = [
  { value: 'all', label: 'All Fee Tiers' },
  { value: '100', label: '0.01%' },
  { value: '500', label: '0.05%' },
  { value: '3000', label: '0.3%' },
  { value: '10000', label: '1%' },
];

export default function DiscoverPage() {
  const t = useTranslation();
  const [pools, setPools] = useState<Pool[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNetwork, setSelectedNetwork] = useState('ethereum');
  const [selectedExchange, setSelectedExchange] = useState('uniswap-v3');
  const [selectedFeeTier, setSelectedFeeTier] = useState('all');
  const [sortField, setSortField] = useState<SortField>('tvl');
  const [networkDropdownOpen, setNetworkDropdownOpen] = useState(false);
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [protocolStats, setProtocolStats] = useState<{
    totalValueLockedUSD: number;
    totalVolumeUSD: number;
    poolCount: number;
  } | null>(null);
  const [page, setPage] = useState(1);
  const poolsPerPage = 50;

  // Fetch protocol stats
  useEffect(() => {
    async function loadStats() {
      const stats = await fetchProtocolStats(selectedNetwork);
      setProtocolStats(stats);
    }
    loadStats();
  }, [selectedNetwork]);

  // Fetch pools
  useEffect(() => {
    async function loadPools() {
      setIsLoading(true);
      try {
        const data = await fetchPools(
          selectedExchange,
          selectedNetwork,
          undefined,
          undefined,
          { first: 1000, orderBy: 'totalValueLockedUSD', orderDirection: 'desc' }
        );
        setPools(data);
      } catch (error) {
        console.error('Error loading pools:', error);
        setPools([]);
      }
      setIsLoading(false);
    }
    loadPools();
    setPage(1);
  }, [selectedExchange, selectedNetwork]);

  // Filter and sort pools
  const filteredPools = useMemo(() => {
    let result = [...pools];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        pool =>
          pool.token0.symbol.toLowerCase().includes(query) ||
          pool.token1.symbol.toLowerCase().includes(query) ||
          pool.token0.name.toLowerCase().includes(query) ||
          pool.token1.name.toLowerCase().includes(query) ||
          pool.id.toLowerCase().includes(query)
      );
    }

    // Fee tier filter
    if (selectedFeeTier !== 'all') {
      result = result.filter(pool => pool.feeTier === parseInt(selectedFeeTier));
    }

    // Sort
    result.sort((a, b) => {
      let aVal: number, bVal: number;
      switch (sortField) {
        case 'tvl':
          aVal = a.tvl;
          bVal = b.tvl;
          break;
        case 'volume24h':
          aVal = a.volume24h;
          bVal = b.volume24h;
          break;
        case 'apr':
          aVal = a.apr;
          bVal = b.apr;
          break;
        case 'fees24h':
          aVal = a.fees24h;
          bVal = b.fees24h;
          break;
        case 'feeTier':
          aVal = a.feeTier;
          bVal = b.feeTier;
          break;
        default:
          return 0;
      }
      return sortDirection === 'desc' ? bVal - aVal : aVal - bVal;
    });

    return result;
  }, [pools, searchQuery, selectedFeeTier, sortField, sortDirection]);

  // Paginate
  const paginatedPools = useMemo(() => {
    const start = (page - 1) * poolsPerPage;
    return filteredPools.slice(start, start + poolsPerPage);
  }, [filteredPools, page]);

  const totalPages = Math.ceil(filteredPools.length / poolsPerPage);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => (prev === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const SortHeader = ({ field, label }: { field: SortField; label: string }) => (
    <button
      onClick={() => handleSort(field)}
      className={cn(
        'flex items-center gap-1 text-xs font-medium transition-colors',
        sortField === field ? 'text-primary' : 'text-muted hover:text-foreground'
      )}
    >
      {label}
      {sortField === field ? (
        sortDirection === 'desc' ? (
          <ChevronDown className="w-3 h-3" />
        ) : (
          <ChevronUp className="w-3 h-3" />
        )
      ) : (
        <ArrowUpDown className="w-3 h-3 opacity-50" />
      )}
    </button>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            <span className="gradient-text">{t('discover')}</span>
          </h1>
          <p className="text-muted mt-2">
            {t('discoverDescription')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setIsLoading(true);
              fetchPools(selectedExchange, selectedNetwork, undefined, undefined, { first: 1000 })
                .then(setPools)
                .finally(() => setIsLoading(false));
            }}
          >
            <RefreshCw className={cn('w-4 h-4 mr-2', isLoading && 'animate-spin')} />
            {t('refresh')}
          </Button>
        </div>
      </div>

      {/* Protocol Stats */}
      {protocolStats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          <Card hover className="p-5 group">
            <div className="flex items-center gap-2 text-muted mb-3">
              <div className="p-2 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                <Layers className="w-4 h-4 text-primary" />
              </div>
              <span className="text-xs font-medium uppercase tracking-wide">{t('totalPools')}</span>
            </div>
            <p className="text-2xl font-bold">{protocolStats.poolCount.toLocaleString()}</p>
          </Card>
          <Card hover className="p-5 group">
            <div className="flex items-center gap-2 text-muted mb-3">
              <div className="p-2 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                <TrendingUp className="w-4 h-4 text-primary" />
              </div>
              <span className="text-xs font-medium uppercase tracking-wide">{t('poolsLoaded')}</span>
            </div>
            <p className="text-2xl font-bold">{filteredPools.length.toLocaleString()}</p>
          </Card>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-8">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-[350px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary/60" />
          <input
            type="text"
            placeholder={t('searchByToken')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-card/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all placeholder:text-muted"
          />
        </div>

        {/* Exchange Selector */}
        <div className="relative">
          <select
            value={selectedExchange}
            onChange={(e) => setSelectedExchange(e.target.value)}
            className="appearance-none px-4 py-2.5 pr-9 bg-card/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 cursor-pointer transition-all hover:border-primary/30"
          >
            {EXCHANGES.map(exchange => (
              <option key={exchange.id} value={exchange.id}>
                {exchange.icon} {exchange.name}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary/60 pointer-events-none" />
        </div>

        {/* Network Selector */}
        <div className="relative">
          <button
            onClick={() => setNetworkDropdownOpen(!networkDropdownOpen)}
            className="flex items-center gap-2 px-4 py-2.5 pr-9 bg-card/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 cursor-pointer transition-all hover:border-primary/30"
          >
            <img
              src={NETWORKS.find(n => n.id === selectedNetwork)?.logo}
              alt=""
              className="w-5 h-5 rounded-full"
            />
            {NETWORKS.find(n => n.id === selectedNetwork)?.name}
          </button>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary/60 pointer-events-none" />
          {networkDropdownOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setNetworkDropdownOpen(false)} />
              <div className="absolute top-full left-0 mt-1 w-48 bg-card border border-border rounded-xl shadow-lg z-50 py-1 overflow-hidden">
                {NETWORKS.map(network => (
                  <button
                    key={network.id}
                    onClick={() => {
                      setSelectedNetwork(network.id);
                      setNetworkDropdownOpen(false);
                    }}
                    className={cn(
                      'w-full flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors',
                      selectedNetwork === network.id
                        ? 'bg-primary/10 text-primary'
                        : 'text-foreground hover:bg-background'
                    )}
                  >
                    <img src={network.logo} alt="" className="w-5 h-5 rounded-full" />
                    {network.name}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Fee Tier Filter */}
        <div className="relative">
          <select
            value={selectedFeeTier}
            onChange={(e) => setSelectedFeeTier(e.target.value)}
            className="appearance-none px-4 py-2.5 pr-9 bg-card/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 cursor-pointer transition-all hover:border-primary/30"
          >
            {FEE_TIERS.map(tier => (
              <option key={tier.value} value={tier.value}>
                {tier.label}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary/60 pointer-events-none" />
        </div>
      </div>

      {/* Pool Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-card">
                <th className="text-left p-4 text-xs font-medium text-muted">#</th>
                <th className="text-left p-4 text-xs font-medium text-muted">{t('pool')}</th>
                <th className="text-right p-4">
                  <SortHeader field="tvl" label={t('tvl')} />
                </th>
                <th className="text-right p-4">
                  <SortHeader field="volume24h" label={t('volume24h')} />
                </th>
                <th className="text-right p-4">
                  <SortHeader field="fees24h" label={t('fees24h')} />
                </th>
                <th className="text-right p-4">
                  <SortHeader field="apr" label={t('apr')} />
                </th>
                <th className="text-right p-4">
                  <SortHeader field="feeTier" label={t('feeTier')} />
                </th>
                <th className="text-center p-4 text-xs font-medium text-muted">{t('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center">
                    <RefreshCw className="w-8 h-8 text-primary mx-auto mb-4 animate-spin" />
                    <p className="text-muted">{t('loadingPoolsEthereum')}</p>
                  </td>
                </tr>
              ) : paginatedPools.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center">
                    <Layers className="w-8 h-8 text-muted mx-auto mb-4" />
                    <p className="text-muted">{t('noPoolsFound')}</p>
                  </td>
                </tr>
              ) : (
                paginatedPools.map((pool, index) => (
                  <tr
                    key={pool.id}
                    className="border-b border-border hover:bg-card-hover transition-colors"
                  >
                    <td className="p-4 text-sm text-muted">
                      {(page - 1) * poolsPerPage + index + 1}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <TokenPairIcon token0Symbol={pool.token0.symbol} token1Symbol={pool.token1.symbol} size="md" />
                        <div>
                          <p className="font-medium text-sm">
                            {pool.token0.symbol}/{pool.token1.symbol}
                          </p>
                          <p className="text-xs text-muted">
                            {pool.network.charAt(0).toUpperCase() + pool.network.slice(1)}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-right">
                      <p className="font-medium text-sm">{formatCurrency(pool.tvl)}</p>
                    </td>
                    <td className="p-4 text-right">
                      <p className="font-medium text-sm">{formatCurrency(pool.volume24h)}</p>
                    </td>
                    <td className="p-4 text-right">
                      <p className="font-medium text-sm text-success">{formatCurrency(pool.fees24h)}</p>
                    </td>
                    <td className="p-4 text-right">
                      <p className={cn(
                        "font-medium text-sm",
                        pool.apr > 50 ? "text-success" : pool.apr > 20 ? "text-yellow-400" : "text-foreground"
                      )}>
                        {formatNumber(pool.apr, 2)}%
                      </p>
                    </td>
                    <td className="p-4 text-right">
                      <span className="px-2 py-1 bg-primary/10 text-primary rounded text-xs font-medium">
                        {(pool.feeTier / 10000).toFixed(2)}%
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <Link
                          href={`/simulate?pool=${pool.id}`}
                          className="px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-medium hover:bg-primary/80 transition-colors"
                        >
                          {t('simulate')}
                        </Link>
                        <a
                          href={`https://info.uniswap.org/#/pools/${pool.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 text-muted hover:text-primary rounded-lg hover:bg-card transition-colors"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t border-border">
            <p className="text-sm text-muted">
              {t('showing')} {(page - 1) * poolsPerPage + 1} {t('to')} {Math.min(page * poolsPerPage, filteredPools.length)} {t('of')} {filteredPools.length} {t('pools')}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
              >
                {t('previous')}
              </Button>
              <span className="text-sm text-muted px-2">
                {t('page')} {page} {t('of')} {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page === totalPages}
                onClick={() => setPage(p => p + 1)}
              >
                {t('next')}
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
