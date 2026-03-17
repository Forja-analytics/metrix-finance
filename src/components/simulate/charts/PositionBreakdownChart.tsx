'use client';

import { useState, useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  CartesianGrid,
} from 'recharts';
import { Card } from '@/components/ui/Card';
import { calculateTokenAmounts } from '@/lib/utils';

type ViewMode = 'token' | 'value' | 'total';

interface PositionBreakdownChartProps {
  pool: {
    token0: { symbol: string; price?: number; decimals: number };
    token1: { symbol: string; price?: number; decimals: number };
  };
  depositAmount: number;
  currentPrice: number;
  lowerPrice: number;
  upperPrice: number;
}

export default function PositionBreakdownChart({
  pool,
  depositAmount,
  currentPrice,
  lowerPrice,
  upperPrice,
}: PositionBreakdownChartProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('token');

  const token0Price = pool.token0.price ?? 0;
  const token1Price = pool.token1.price ?? 0;

  const data = useMemo(() => {
    if (lowerPrice <= 0 || upperPrice <= 0 || lowerPrice >= upperPrice || depositAmount <= 0) {
      return [];
    }

    const steps = 100;
    const stepSize = (upperPrice - lowerPrice) / steps;
    const points: { price: number; token0: number; token1: number }[] = [];

    for (let i = 0; i <= steps; i++) {
      const price = lowerPrice + stepSize * i;
      const { token0Amount, token1Amount } = calculateTokenAmounts(
        depositAmount,
        price,
        lowerPrice,
        upperPrice,
        token0Price > 0 ? token0Price : price,
        token1Price > 0 ? token1Price : 1
      );

      if (viewMode === 'token') {
        points.push({ price, token0: token0Amount, token1: token1Amount });
      } else if (viewMode === 'value') {
        points.push({
          price,
          token0: token0Amount * (token0Price > 0 ? token0Price : price),
          token1: token1Amount * (token1Price > 0 ? token1Price : 1),
        });
      } else {
        const val0 = token0Amount * (token0Price > 0 ? token0Price : price);
        const val1 = token1Amount * (token1Price > 0 ? token1Price : 1);
        points.push({
          price,
          token0: val0,
          token1: val0 + val1,
        });
      }
    }

    return points;
  }, [lowerPrice, upperPrice, depositAmount, currentPrice, token0Price, token1Price, viewMode]);

  const formatPrice = (value: number) => {
    if (value >= 1000) return value.toFixed(0);
    if (value >= 1) return value.toFixed(2);
    return value.toFixed(6);
  };

  const formatValue = (value: number) => {
    if (viewMode === 'token') {
      if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
      if (value >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
      return value.toFixed(2);
    }
    if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
    if (value >= 1e3) return `$${(value / 1e3).toFixed(1)}K`;
    return `$${value.toFixed(2)}`;
  };

  const tabs: { key: ViewMode; label: string }[] = [
    { key: 'token', label: 'By Token' },
    { key: 'value', label: 'By Value' },
    { key: 'total', label: 'By Total Value' },
  ];

  if (!data || data.length === 0) {
    return (
      <Card className="p-4">
        <h3 className="text-sm font-semibold text-zinc-200">Position Breakdown</h3>
        <div className="flex items-center justify-center h-[250px] text-zinc-500 text-sm">
          No data available
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-semibold text-zinc-200">Position Breakdown</h3>
        <div className="flex items-center gap-0.5 bg-zinc-800 rounded-lg p-0.5">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setViewMode(tab.key)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                viewMode === tab.key
                  ? 'bg-indigo-500/20 text-indigo-300'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span className="px-2 py-0.5 rounded-full bg-zinc-800 text-[11px] text-zinc-400">
          MIN {formatPrice(lowerPrice)}
        </span>
        <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-[11px] text-indigo-300">
          PRICE {formatPrice(currentPrice)}
        </span>
        <span className="px-2 py-0.5 rounded-full bg-zinc-800 text-[11px] text-zinc-400">
          MAX {formatPrice(upperPrice)}
        </span>
      </div>

      <ResponsiveContainer width="100%" height={270}>
        <AreaChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
          <defs>
            <linearGradient id="gradToken0" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#818cf8" stopOpacity={0.4} />
              <stop offset="100%" stopColor="#818cf8" stopOpacity={0.05} />
            </linearGradient>
            <linearGradient id="gradToken1" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.4} />
              <stop offset="100%" stopColor="#06b6d4" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#2a2a32" />
          <XAxis
            dataKey="price"
            stroke="#71717a"
            tick={{ fill: '#71717a', fontSize: 10 }}
            tickLine={false}
            axisLine={{ stroke: '#2a2a32' }}
            tickFormatter={(v) => formatPrice(v)}
          />
          <YAxis
            stroke="#71717a"
            tick={{ fill: '#71717a', fontSize: 10 }}
            tickLine={false}
            axisLine={{ stroke: '#2a2a32' }}
            tickFormatter={(v) => formatValue(v)}
            width={55}
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
            formatter={((value: number, name: string) => {
              const label =
                name === 'token0'
                  ? pool.token0.symbol
                  : viewMode === 'total'
                    ? 'Total'
                    : pool.token1.symbol;
              return [formatValue(value), label];
            }) as any}
            labelFormatter={(label) => `Price: ${formatPrice(Number(label))}`}
          />
          <ReferenceLine
            x={currentPrice}
            stroke="#ef4444"
            strokeDasharray="4 4"
            strokeWidth={1}
            label={{ value: 'Current', fill: '#ef4444', fontSize: 10, position: 'top' }}
          />
          {viewMode !== 'total' && (
            <Area
              type="monotone"
              dataKey="token1"
              stackId="1"
              stroke="#06b6d4"
              fill="url(#gradToken1)"
              strokeWidth={1.5}
            />
          )}
          <Area
            type="monotone"
            dataKey="token0"
            stackId={viewMode === 'total' ? undefined : '1'}
            stroke="#818cf8"
            fill="url(#gradToken0)"
            strokeWidth={1.5}
          />
          {viewMode === 'total' && (
            <Area
              type="monotone"
              dataKey="token1"
              stroke="#06b6d4"
              fill="url(#gradToken1)"
              strokeWidth={1.5}
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </Card>
  );
}
