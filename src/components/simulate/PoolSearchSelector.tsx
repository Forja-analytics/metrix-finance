'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { Search, ChevronDown, X } from 'lucide-react';
import { Pool } from '@/types';
import { TokenPairIcon } from '@/components/ui/TokenIcon';
import { formatCurrency, formatPercent, cn } from '@/lib/utils';

interface PoolSearchSelectorProps {
  pools: Pool[];
  selectedPool: Pool | null;
  onSelect: (pool: Pool) => void;
  isLoading?: boolean;
}

export function PoolSearchSelector({
  pools,
  selectedPool,
  onSelect,
  isLoading = false,
}: PoolSearchSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Filter pools based on search
  const filteredPools = useMemo(() => {
    if (!search.trim()) return pools;

    const query = search.toLowerCase();
    return pools.filter((pool) => {
      const token0Match =
        pool.token0.symbol.toLowerCase().includes(query) ||
        pool.token0.name?.toLowerCase().includes(query);
      const token1Match =
        pool.token1.symbol.toLowerCase().includes(query) ||
        pool.token1.name?.toLowerCase().includes(query);
      const pairMatch = `${pool.token0.symbol}/${pool.token1.symbol}`.toLowerCase().includes(query);
      const addressMatch = pool.id.toLowerCase().includes(query);

      return token0Match || token1Match || pairMatch || addressMatch;
    });
  }, [pools, search]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus input when dropdown opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleSelect = (pool: Pool) => {
    onSelect(pool);
    setIsOpen(false);
    setSearch('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSearch('');
    inputRef.current?.focus();
  };

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Selected Pool Display / Search Input */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'w-full flex items-center gap-3 p-4 rounded-xl border transition-all',
          'bg-card hover:bg-card-hover border-border',
          isOpen && 'border-primary ring-1 ring-primary/20'
        )}
      >
        {selectedPool ? (
          <>
            <TokenPairIcon
              token0Symbol={selectedPool.token0.symbol}
              token1Symbol={selectedPool.token1.symbol}
              size="lg"
            />
            <div className="flex-1 text-left">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-lg">
                  {selectedPool.token0.symbol}/{selectedPool.token1.symbol}
                </span>
                <span className="px-2 py-0.5 text-xs font-medium bg-primary/10 text-primary rounded-full">
                  {selectedPool.feeTier / 10000}%
                </span>
              </div>
              <div className="flex items-center gap-4 text-sm text-muted mt-0.5">
                <span>TVL: {formatCurrency(selectedPool.tvl, true)}</span>
                <span>APR: {formatPercent(selectedPool.apr, false)}</span>
              </div>
            </div>
            <ChevronDown className={cn('w-5 h-5 text-muted transition-transform', isOpen && 'rotate-180')} />
          </>
        ) : (
          <>
            <div className="w-9 h-9 rounded-full bg-card-hover flex items-center justify-center">
              <Search className="w-4 h-4 text-muted" />
            </div>
            <span className="flex-1 text-left text-muted">Search for a pool...</span>
            <ChevronDown className={cn('w-5 h-5 text-muted transition-transform', isOpen && 'rotate-180')} />
          </>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 top-full left-0 right-0 mt-2 bg-card border border-border rounded-xl shadow-xl overflow-hidden">
          {/* Search Input */}
          <div className="p-3 border-b border-border">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by token, pair, or address..."
                className="w-full pl-10 pr-10 py-2.5 bg-background rounded-lg border border-border text-sm focus:outline-none focus:border-primary"
              />
              {search && (
                <button
                  onClick={handleClear}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-card-hover"
                >
                  <X className="w-4 h-4 text-muted" />
                </button>
              )}
            </div>
          </div>

          {/* Pool List */}
          <div className="max-h-80 overflow-y-auto">
            {isLoading ? (
              <div className="p-8 text-center text-muted">
                <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2" />
                Loading pools...
              </div>
            ) : filteredPools.length === 0 ? (
              <div className="p-8 text-center text-muted">
                {search ? 'No pools found matching your search' : 'No pools available'}
              </div>
            ) : (
              filteredPools.slice(0, 50).map((pool) => (
                <button
                  key={pool.id}
                  onClick={() => handleSelect(pool)}
                  className={cn(
                    'w-full flex items-center gap-3 p-3 hover:bg-card-hover transition-colors text-left',
                    selectedPool?.id === pool.id && 'bg-primary/5'
                  )}
                >
                  <TokenPairIcon
                    token0Symbol={pool.token0.symbol}
                    token1Symbol={pool.token1.symbol}
                    size="md"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">
                        {pool.token0.symbol}/{pool.token1.symbol}
                      </span>
                      <span className="px-1.5 py-0.5 text-xs bg-card-hover rounded">
                        {pool.feeTier / 10000}%
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted mt-0.5">
                      <span>TVL: {formatCurrency(pool.tvl, true)}</span>
                      <span className="text-success">APR: {formatPercent(pool.apr, false)}</span>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Footer */}
          {filteredPools.length > 50 && (
            <div className="p-2 text-center text-xs text-muted border-t border-border">
              Showing 50 of {filteredPools.length} pools. Refine your search to see more.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
