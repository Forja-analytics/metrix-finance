'use client';

import { Card } from '@/components/ui/Card';
import { formatCurrency, formatPercent } from '@/lib/utils';
import { TrendingUp, TrendingDown, DollarSign, BarChart3, Activity, Gauge } from 'lucide-react';
import { MarketData } from '@/types';
import { getFearGreedLabel } from '@/lib/constants';

interface MarketMetricsProps {
  data: MarketData;
}

export function MarketMetrics({ data }: MarketMetricsProps) {
  const fearGreedInfo = getFearGreedLabel(data.fearGreedIndex);

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      <MetricCard
        label="DeFi Market Cap"
        value={formatCurrency(data.defiMarketCap, true)}
        change={data.defiMarketCapChange}
        icon={<DollarSign className="w-4 h-4" />}
      />
      <MetricCard
        label="Crypto Market Cap"
        value={formatCurrency(data.cryptoMarketCap, true)}
        change={data.cryptoMarketCapChange}
        icon={<DollarSign className="w-4 h-4" />}
      />
      <MetricCard
        label="DeFi Volume (24h)"
        value={formatCurrency(data.defiVolume24h, true)}
        change={data.defiVolumeChange}
        icon={<BarChart3 className="w-4 h-4" />}
      />
      <MetricCard
        label="Crypto Volume (24h)"
        value={formatCurrency(data.cryptoVolume24h, true)}
        icon={<BarChart3 className="w-4 h-4" />}
      />
      <FearGreedCard
        value={data.fearGreedIndex}
        label={fearGreedInfo.label}
        color={fearGreedInfo.color}
      />
      <AltcoinSeasonCard value={data.altcoinSeasonIndex} />
    </div>
  );
}

interface MetricCardProps {
  label: string;
  value: string;
  change?: number;
  icon: React.ReactNode;
}

function MetricCard({ label, value, change, icon }: MetricCardProps) {
  const isPositive = change && change > 0;
  const isNegative = change && change < 0;

  return (
    <Card className="p-3">
      <div className="flex items-center gap-2 text-muted mb-1">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <div className="flex items-end justify-between">
        <span className="text-lg font-semibold">{value}</span>
        {change !== undefined && (
          <div className={`flex items-center gap-0.5 text-xs ${isPositive ? 'text-success' : isNegative ? 'text-danger' : 'text-muted'}`}>
            {isPositive ? <TrendingUp className="w-3 h-3" /> : isNegative ? <TrendingDown className="w-3 h-3" /> : null}
            <span>{formatPercent(change)}</span>
          </div>
        )}
      </div>
    </Card>
  );
}

interface FearGreedCardProps {
  value: number;
  label: string;
  color: string;
}

function FearGreedCard({ value, label, color }: FearGreedCardProps) {
  return (
    <Card className="p-3">
      <div className="flex items-center gap-2 text-muted mb-1">
        <Gauge className="w-4 h-4" />
        <span className="text-xs">Fear & Greed</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-lg font-semibold">{value}</span>
        <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: `${color}20`, color }}>
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

interface AltcoinSeasonCardProps {
  value: number;
}

function AltcoinSeasonCard({ value }: AltcoinSeasonCardProps) {
  const isBitcoinSeason = value < 50;
  const label = isBitcoinSeason ? 'Bitcoin Season' : 'Altcoin Season';
  const color = isBitcoinSeason ? '#f7931a' : '#627eea';

  return (
    <Card className="p-3">
      <div className="flex items-center gap-2 text-muted mb-1">
        <Activity className="w-4 h-4" />
        <span className="text-xs">Altcoin Index</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-lg font-semibold">{value}</span>
        <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: `${color}20`, color }}>
          {label}
        </span>
      </div>
      <div className="mt-2 h-1.5 bg-background rounded-full overflow-hidden flex">
        <div
          className="h-full transition-all duration-500"
          style={{ width: `${value}%`, background: 'linear-gradient(90deg, #f7931a 0%, #627eea 100%)' }}
        />
      </div>
    </Card>
  );
}
