'use client';

import { useState, useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { Card } from '@/components/ui/Card';
import type { PoolDayData } from '@/types';

interface VolumeHistoryChartProps {
  dayData: PoolDayData[];
}

export default function VolumeHistoryChart({ dayData }: VolumeHistoryChartProps) {
  const [zoomLevel, setZoomLevel] = useState(1);

  const visibleData = useMemo(() => {
    if (!dayData || dayData.length === 0) return [];
    const count = Math.max(7, Math.floor(dayData.length / zoomLevel));
    return dayData.slice(-count).map((d, i) => ({
      day: i + 1,
      volume: d.volumeUSD,
      date: new Date(d.date * 1000).toLocaleDateString(),
    }));
  }, [dayData, zoomLevel]);

  const stats = useMemo(() => {
    if (!dayData || dayData.length === 0) return null;
    const volumes = dayData.map((d) => d.volumeUSD).filter((v) => v > 0);
    if (volumes.length === 0) return null;
    return {
      min: Math.min(...volumes),
      max: Math.max(...volumes),
      avg: volumes.reduce((a, b) => a + b, 0) / volumes.length,
    };
  }, [dayData]);

  const formatVolume = (value: number) => {
    if (!value || isNaN(value)) return 'NaN';
    if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
    if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}m`;
    if (value >= 1e3) return `$${(value / 1e3).toFixed(1)}K`;
    return `$${value.toFixed(0)}`;
  };

  if (!dayData || dayData.length === 0) {
    return (
      <Card className="p-4">
        <h3 className="text-sm font-semibold text-zinc-200">Volume History</h3>
        <div className="flex items-center justify-center h-[250px] text-zinc-500 text-sm">
          No data available
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-semibold text-zinc-200">Volume History</h3>
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
          MIN {formatVolume(stats?.min ?? NaN)}
        </span>
        <span className="px-2 py-0.5 rounded-full bg-zinc-800 text-[11px] text-zinc-400">
          AVG {formatVolume(stats?.avg ?? NaN)}
        </span>
        <span className="px-2 py-0.5 rounded-full bg-zinc-800 text-[11px] text-zinc-400">
          MAX {formatVolume(stats?.max ?? NaN)}
        </span>
      </div>

      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={visibleData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2a2a32" vertical={false} />
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
            tickFormatter={(v) => formatVolume(v)}
            width={50}
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
            formatter={((value: number) => [formatVolume(value), 'Volume']) as any}
            labelFormatter={(_label, payload) => {
              if (payload && payload.length > 0) {
                return payload[0].payload.date;
              }
              return `Day ${_label}`;
            }}
            cursor={{ fill: 'rgba(99, 102, 241, 0.1)' }}
          />
          <Bar dataKey="volume" fill="#8b5cf6" radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}
