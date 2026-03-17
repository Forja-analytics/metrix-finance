'use client';

import { useState, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  CartesianGrid,
} from 'recharts';
import { Card } from '@/components/ui/Card';
import type { PoolDayData } from '@/types';

interface PoolPriceChartProps {
  dayData: PoolDayData[];
  currentPrice: number;
  token0Symbol: string;
  token1Symbol: string;
  minPrice?: number;
  maxPrice?: number;
}

export default function PoolPriceChart({
  dayData,
  currentPrice,
  token0Symbol,
  token1Symbol,
  minPrice,
  maxPrice,
}: PoolPriceChartProps) {
  const [zoomLevel, setZoomLevel] = useState(1);

  const visibleData = useMemo(() => {
    if (!dayData || dayData.length === 0) return [];
    const count = Math.max(7, Math.floor(dayData.length / zoomLevel));
    return dayData.slice(-count).map((d, i) => ({
      day: i + 1,
      price: d.close,
      date: new Date(d.date * 1000).toLocaleDateString(),
    }));
  }, [dayData, zoomLevel]);

  const stats = useMemo(() => {
    if (!dayData || dayData.length === 0) return null;
    const prices = dayData.map((d) => d.close).filter((p) => p > 0);
    if (prices.length === 0) return null;
    return {
      min: Math.min(...prices),
      max: Math.max(...prices),
      avg: prices.reduce((a, b) => a + b, 0) / prices.length,
    };
  }, [dayData]);

  const formatPrice = (value: number) => {
    if (!value || isNaN(value)) return 'NaN';
    if (value >= 1000) return `$${value.toFixed(0)}`;
    if (value >= 1) return `$${value.toFixed(2)}`;
    return `$${value.toFixed(6)}`;
  };

  const formatStatValue = (value: number | undefined) => {
    if (value === undefined || isNaN(value)) return 'NaN';
    return formatPrice(value);
  };

  if (!dayData || dayData.length === 0) {
    return (
      <Card className="p-4">
        <h3 className="text-sm font-semibold text-zinc-200">
          {token0Symbol}/{token1Symbol} Pool Price
        </h3>
        <div className="flex items-center justify-center h-[250px] text-zinc-500 text-sm">
          No data available
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-semibold text-zinc-200">
          {token0Symbol}/{token1Symbol} Pool Price
        </h3>
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

      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span className="px-2 py-0.5 rounded-full bg-zinc-800 text-[11px] text-zinc-400">
          MIN {formatStatValue(stats?.min)}
        </span>
        <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-[11px] text-indigo-300">
          PRICE {formatPrice(currentPrice)}
        </span>
        <span className="px-2 py-0.5 rounded-full bg-zinc-800 text-[11px] text-zinc-400">
          AVG {formatStatValue(stats?.avg)}
        </span>
        <span className="px-2 py-0.5 rounded-full bg-zinc-800 text-[11px] text-zinc-400">
          MAX {formatStatValue(stats?.max)}
        </span>
      </div>

      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={visibleData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2a2a32" />
          <XAxis
            dataKey="day"
            stroke="#71717a"
            tick={{ fill: '#71717a', fontSize: 10 }}
            tickLine={false}
            axisLine={{ stroke: '#2a2a32' }}
          />
          <YAxis
            stroke="#71717a"
            tick={{ fill: '#71717a', fontSize: 10 }}
            tickLine={false}
            axisLine={{ stroke: '#2a2a32' }}
            tickFormatter={(v) => `$${v >= 1000 ? `${(v / 1000).toFixed(1)}K` : v.toFixed(2)}`}
            width={55}
            domain={['auto', 'auto']}
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
            formatter={((value: number) => [formatPrice(value), 'Price']) as any}
            labelFormatter={(_label, payload) => {
              if (payload && payload.length > 0) {
                return payload[0].payload.date;
              }
              return `Day ${_label}`;
            }}
          />
          {minPrice !== undefined && (
            <ReferenceLine
              y={minPrice}
              stroke="#22c55e"
              strokeDasharray="6 3"
              strokeWidth={1}
              label={{ value: 'Min', fill: '#22c55e', fontSize: 10, position: 'right' }}
            />
          )}
          {maxPrice !== undefined && (
            <ReferenceLine
              y={maxPrice}
              stroke="#ef4444"
              strokeDasharray="6 3"
              strokeWidth={1}
              label={{ value: 'Max', fill: '#ef4444', fontSize: 10, position: 'right' }}
            />
          )}
          <Line
            type="monotone"
            dataKey="price"
            stroke="#818cf8"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: '#818cf8', stroke: '#1a1a1f', strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </Card>
  );
}
