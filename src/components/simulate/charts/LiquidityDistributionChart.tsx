'use client';

import { useState, useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from 'recharts';
import { Card } from '@/components/ui/Card';
import type { LiquidityBin } from '@/types';

interface LiquidityDistributionChartProps {
  bins: LiquidityBin[];
  currentPrice: number;
  token0Symbol: string;
  token1Symbol: string;
  lowerPrice?: number;
  upperPrice?: number;
  ticksInRange?: number;
}

export default function LiquidityDistributionChart({
  bins,
  currentPrice,
  token0Symbol,
  token1Symbol,
  lowerPrice,
  upperPrice,
  ticksInRange,
}: LiquidityDistributionChartProps) {
  const [zoomLevel, setZoomLevel] = useState(1);

  const visibleBins = useMemo(() => {
    if (!bins || bins.length === 0) return [];
    const currentIndex = bins.findIndex((b) => b.isCurrent);
    const center = currentIndex >= 0 ? currentIndex : Math.floor(bins.length / 2);
    const range = Math.max(10, Math.floor(bins.length / (2 * zoomLevel)));
    const start = Math.max(0, center - range);
    const end = Math.min(bins.length, center + range);
    return bins.slice(start, end);
  }, [bins, zoomLevel]);

  const getBarColor = (bin: LiquidityBin) => {
    if (bin.isCurrent) return '#22c55e';
    if (bin.isInRange) return '#8b5cf6';
    return '#4c1d95';
  };

  const formatPrice = (value: number) => {
    if (value >= 1000) return value.toFixed(0);
    if (value >= 1) return value.toFixed(2);
    return value.toFixed(6);
  };

  if (!bins || bins.length === 0) {
    return (
      <Card className="p-4">
        <h3 className="text-sm font-semibold text-zinc-200">Liquidity Distribution</h3>
        <div className="flex items-center justify-center h-[250px] text-zinc-500 text-sm">
          No data available
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-semibold text-zinc-200">Liquidity Distribution</h3>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setZoomLevel((z) => Math.max(0.5, z - 0.5))}
            className="w-6 h-6 flex items-center justify-center rounded bg-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 text-xs font-bold transition-colors"
          >
            -
          </button>
          <button
            onClick={() => setZoomLevel((z) => Math.min(5, z + 0.5))}
            className="w-6 h-6 flex items-center justify-center rounded bg-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 text-xs font-bold transition-colors"
          >
            +
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3 mb-3 text-xs text-zinc-400">
        <span>
          1 {token0Symbol} = {formatPrice(currentPrice)} {token1Symbol}
        </span>
        {ticksInRange !== undefined && (
          <span className="text-zinc-500">Ticks in Range: {ticksInRange}</span>
        )}
      </div>

      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={visibleBins} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
          <XAxis
            dataKey="price0"
            stroke="#71717a"
            tick={{ fill: '#71717a', fontSize: 10 }}
            tickFormatter={(v) => formatPrice(v)}
            tickLine={false}
            axisLine={{ stroke: '#2a2a32' }}
          />
          <YAxis
            stroke="#71717a"
            tick={{ fill: '#71717a', fontSize: 10 }}
            tickLine={false}
            axisLine={{ stroke: '#2a2a32' }}
            tickFormatter={(v) => {
              if (v >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
              if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
              if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
              return v.toFixed(0);
            }}
            width={45}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1a1a1f',
              border: '1px solid #2a2a32',
              borderRadius: '8px',
              fontSize: '12px',
              color: '#e4e4e7',
            }}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={((value: number) => [value.toLocaleString(), 'Liquidity']) as any}
            labelFormatter={(label) => `Price: ${formatPrice(Number(label))}`}
            cursor={{ fill: 'rgba(99, 102, 241, 0.1)' }}
          />
          <ReferenceLine
            x={currentPrice}
            stroke="#22c55e"
            strokeWidth={1.5}
            label={{ value: 'Current', fill: '#22c55e', fontSize: 10, position: 'top' }}
          />
          {lowerPrice !== undefined && (
            <ReferenceLine
              x={lowerPrice}
              stroke="#8b5cf6"
              strokeDasharray="4 4"
              strokeWidth={1}
            />
          )}
          {upperPrice !== undefined && (
            <ReferenceLine
              x={upperPrice}
              stroke="#8b5cf6"
              strokeDasharray="4 4"
              strokeWidth={1}
            />
          )}
          <Bar dataKey="liquidity" radius={[2, 2, 0, 0]}>
            {visibleBins.map((bin, index) => (
              <Cell key={index} fill={getBarColor(bin)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}
