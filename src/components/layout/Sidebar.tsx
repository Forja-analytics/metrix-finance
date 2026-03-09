'use client';

import { useStore } from '@/lib/store';
import { EXCHANGES } from '@/lib/constants';
import { Select } from '@/components/ui/Select';
import { Card } from '@/components/ui/Card';
import { Lock, TrendingUp, History } from 'lucide-react';
import { Pool } from '@/types';
import { formatCurrency } from '@/lib/utils';

export function Sidebar() {
  const {
    selectedExchange,
    selectedNetwork,
    setSelectedExchange,
    setSelectedNetwork,
    recentlyViewedPools,
    isPro,
    setAuthModalOpen,
  } = useStore();

  const exchangeOptions = EXCHANGES.map((ex) => ({
    value: ex.id,
    label: ex.name,
  }));

  const networkOptions = selectedExchange.networks.map((net) => ({
    value: net.id,
    label: net.name,
  }));

  const handleExchangeChange = (value: string) => {
    const exchange = EXCHANGES.find((ex) => ex.id === value);
    if (exchange) setSelectedExchange(exchange);
  };

  const handleNetworkChange = (value: string) => {
    const network = selectedExchange.networks.find((net) => net.id === value);
    if (network) setSelectedNetwork(network);
  };

  return (
    <aside className="w-72 flex-shrink-0 hidden lg:block">
      <div className="sticky top-20 space-y-4">
        {/* Exchange & Network Selection */}
        <Card className="p-4 space-y-3">
          <div>
            <label className="block text-xs text-muted mb-1.5">Exchange</label>
            <Select
              options={exchangeOptions}
              value={selectedExchange.id}
              onChange={handleExchangeChange}
            />
          </div>
          <div>
            <label className="block text-xs text-muted mb-1.5">Network</label>
            <Select
              options={networkOptions}
              value={selectedNetwork.id}
              onChange={handleNetworkChange}
            />
          </div>
        </Card>

        {/* Recently Viewed */}
        <Card>
          <div className="p-4 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-muted" />
              <span className="text-sm font-medium">Recently Viewed</span>
            </div>
            {!isPro && (
              <Lock className="w-4 h-4 text-muted" />
            )}
          </div>

          {isPro ? (
            <div className="p-2 max-h-64 overflow-y-auto">
              {recentlyViewedPools.length === 0 ? (
                <p className="text-sm text-muted p-3 text-center">
                  No recently viewed pools
                </p>
              ) : (
                recentlyViewedPools.map((pool: Pool) => (
                  <RecentPoolItem key={pool.id} pool={pool} />
                ))
              )}
            </div>
          ) : (
            <div className="p-4 text-center">
              <p className="text-sm text-muted mb-3">
                Upgrade to Metrix Pro to see your recently viewed pools
              </p>
              <button
                onClick={() => setAuthModalOpen(true)}
                className="text-sm text-primary hover:underline"
              >
                Upgrade to Pro
              </button>
            </div>
          )}
        </Card>
      </div>
    </aside>
  );
}

function RecentPoolItem({ pool }: { pool: Pool }) {
  return (
    <div className="p-2 rounded-lg hover:bg-card-hover transition-colors cursor-pointer">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">
          {pool.token0.symbol}/{pool.token1.symbol}
        </span>
        <span className="text-xs text-muted">{pool.feeTier / 10000}%</span>
      </div>
      <div className="flex items-center gap-2 mt-1">
        <TrendingUp className="w-3 h-3 text-success" />
        <span className="text-xs text-muted">TVL {formatCurrency(pool.tvl, true)}</span>
      </div>
    </div>
  );
}
