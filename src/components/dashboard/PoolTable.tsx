'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { TokenPairIcon } from '@/components/ui/TokenIcon';
import { formatCurrency, formatPercent, cn } from '@/lib/utils';
import { Pool, PoolSortField, SortDirection } from '@/types';
import { ChevronUp, ChevronDown, ExternalLink, Star } from 'lucide-react';
import { useStore } from '@/lib/store';
import Link from 'next/link';

interface PoolTableProps {
  pools: Pool[];
  isLoading?: boolean;
}

export function PoolTable({ pools, isLoading }: PoolTableProps) {
  const [sortField, setSortField] = useState<PoolSortField>('tvl');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const { addRecentlyViewedPool } = useStore();

  const handleSort = (field: PoolSortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const sortedPools = [...pools].sort((a, b) => {
    const multiplier = sortDirection === 'asc' ? 1 : -1;
    return (a[sortField] - b[sortField]) * multiplier;
  });

  const handlePoolClick = (pool: Pool) => {
    addRecentlyViewedPool(pool);
  };

  if (isLoading) {
    return (
      <Card className="overflow-hidden">
        <div className="p-8 text-center">
          <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto" />
          <p className="text-sm text-muted mt-3">Loading pools...</p>
        </div>
      </Card>
    );
  }

  if (pools.length === 0) {
    return (
      <Card className="p-8 text-center">
        <p className="text-muted">Select a valid pair to list pools</p>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left p-4 text-sm font-medium text-muted">Pool</th>
              <th className="text-left p-4 text-sm font-medium text-muted">Fee Tier</th>
              <SortableHeader
                label="TVL"
                field="tvl"
                currentField={sortField}
                direction={sortDirection}
                onSort={handleSort}
              />
              <SortableHeader
                label="Volume (24h)"
                field="volume24h"
                currentField={sortField}
                direction={sortDirection}
                onSort={handleSort}
              />
              <SortableHeader
                label="Fees (24h)"
                field="fees24h"
                currentField={sortField}
                direction={sortDirection}
                onSort={handleSort}
              />
              <SortableHeader
                label="APR"
                field="apr"
                currentField={sortField}
                direction={sortDirection}
                onSort={handleSort}
              />
              <th className="text-right p-4 text-sm font-medium text-muted">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedPools.map((pool) => (
              <tr
                key={pool.id}
                className="border-b border-border hover:bg-card-hover transition-colors cursor-pointer"
                onClick={() => handlePoolClick(pool)}
              >
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    <TokenPairIcon
                      token0Symbol={pool.token0.symbol}
                      token1Symbol={pool.token1.symbol}
                      size="md"
                    />
                    <div>
                      <span className="font-medium">
                        {pool.token0.symbol}/{pool.token1.symbol}
                      </span>
                      <span className="text-xs text-muted block">{pool.network}</span>
                    </div>
                  </div>
                </td>
                <td className="p-4">
                  <span className="px-2 py-1 text-xs bg-primary/10 text-primary rounded-md">
                    {pool.feeTier / 10000}%
                  </span>
                </td>
                <td className="p-4 text-sm">{formatCurrency(pool.tvl, true)}</td>
                <td className="p-4 text-sm">{formatCurrency(pool.volume24h, true)}</td>
                <td className="p-4 text-sm">{formatCurrency(pool.fees24h, true)}</td>
                <td className="p-4">
                  <span className={cn(
                    'text-sm font-medium',
                    pool.apr >= 50 ? 'text-success' : pool.apr >= 20 ? 'text-warning' : 'text-foreground'
                  )}>
                    {formatPercent(pool.apr, false)}
                  </span>
                </td>
                <td className="p-4">
                  <div className="flex items-center justify-end gap-2">
                    <button className="p-1.5 text-muted hover:text-warning rounded-lg hover:bg-card transition-colors">
                      <Star className="w-4 h-4" />
                    </button>
                    <Link
                      href={`/simulate?pool=${pool.id}`}
                      className="p-1.5 text-muted hover:text-primary rounded-lg hover:bg-card transition-colors"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ExternalLink className="w-4 h-4" />
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

interface SortableHeaderProps {
  label: string;
  field: PoolSortField;
  currentField: PoolSortField;
  direction: SortDirection;
  onSort: (field: PoolSortField) => void;
}

function SortableHeader({ label, field, currentField, direction, onSort }: SortableHeaderProps) {
  const isActive = currentField === field;

  return (
    <th
      className="text-left p-4 text-sm font-medium text-muted cursor-pointer hover:text-foreground transition-colors"
      onClick={() => onSort(field)}
    >
      <div className="flex items-center gap-1">
        {label}
        <span className={cn('transition-colors', isActive ? 'text-primary' : 'text-muted')}>
          {isActive && direction === 'asc' ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </span>
      </div>
    </th>
  );
}

