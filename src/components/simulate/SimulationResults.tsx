'use client';

import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { TokenIcon } from '@/components/ui/TokenIcon';
import { SimulationResult, Pool } from '@/types';
import { formatCurrency, formatPercent, formatNumber, cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, DollarSign, Clock, AlertCircle, Coins } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface SimulationResultsProps {
  result: SimulationResult | null;
  pool: Pool | null;
}

export function SimulationResults({ result, pool }: SimulationResultsProps) {
  if (!result) {
    return (
      <Card className="p-8 text-center">
        <TrendingUp className="w-12 h-12 text-muted mx-auto mb-4" />
        <h3 className="text-lg font-medium mb-2">Simulation Results</h3>
        <p className="text-sm text-muted">
          Configure your position and run a simulation to see projected returns
        </p>
      </Card>
    );
  }

  const chartData = result.dailyFees.map((fee, index) => ({
    day: index + 1,
    fees: fee,
    cumulative: result.dailyFees.slice(0, index + 1).reduce((a, b) => a + b, 0),
  }));

  const isNetPositive = result.netReturn > 0;

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3">
        <ResultCard
          icon={<DollarSign className="w-4 h-4" />}
          label="Estimated Fees"
          value={formatCurrency(result.estimatedFees)}
          subValue={`APR: ${formatPercent(result.estimatedAPR, false)}`}
          positive
        />
        <ResultCard
          icon={<AlertCircle className="w-4 h-4" />}
          label="Impermanent Loss"
          value={formatCurrency(result.impermanentLoss)}
          subValue="Expected IL"
          negative
        />
        <ResultCard
          icon={isNetPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
          label="Net Return"
          value={formatCurrency(Math.abs(result.netReturn))}
          subValue={isNetPositive ? 'Profit' : 'Loss'}
          positive={isNetPositive}
          negative={!isNetPositive}
        />
        <ResultCard
          icon={<Clock className="w-4 h-4" />}
          label="Time in Range"
          value={formatPercent(result.timeInRange, false)}
          subValue={result.inRange ? 'Currently in range' : 'Currently out of range'}
          positive={result.inRange}
          negative={!result.inRange}
        />
      </div>

      {/* Fees Chart */}
      <Card>
        <CardHeader>
          <h3 className="font-semibold">Projected Fee Earnings</h3>
        </CardHeader>
        <CardContent>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="feeGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a32" />
                <XAxis
                  dataKey="day"
                  stroke="#71717a"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="#71717a"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `$${value.toFixed(0)}`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1a1a1f',
                    border: '1px solid #2a2a32',
                    borderRadius: '8px',
                  }}
                  labelStyle={{ color: '#71717a' }}
                  formatter={(value: number | undefined) => [formatCurrency(value ?? 0), 'Cumulative Fees']}
                  labelFormatter={(label) => `Day ${label}`}
                />
                <Area
                  type="monotone"
                  dataKey="cumulative"
                  stroke="#6366f1"
                  strokeWidth={2}
                  fill="url(#feeGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Position Breakdown */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Coins className="w-4 h-4 text-muted" />
            <h3 className="font-semibold">Position Breakdown</h3>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-background rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                {pool && <TokenIcon symbol={pool.token0.symbol} size="sm" />}
                <p className="text-sm text-muted">{pool?.token0.symbol || 'Token 0'}</p>
              </div>
              <p className="text-lg font-semibold">{formatNumber(result.token0Amount, 6)}</p>
            </div>
            <div className="bg-background rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                {pool && <TokenIcon symbol={pool.token1.symbol} size="sm" />}
                <p className="text-sm text-muted">{pool?.token1.symbol || 'Token 1'}</p>
              </div>
              <p className="text-lg font-semibold">{formatNumber(result.token1Amount, 6)}</p>
            </div>
          </div>

          <div className="mt-4 p-4 bg-primary/5 border border-primary/20 rounded-lg">
            <h4 className="text-sm font-medium text-primary mb-2">Key Insights</h4>
            <ul className="text-sm text-muted space-y-1">
              <li>Narrower ranges earn more fees but have higher IL risk</li>
              <li>Your position {result.inRange ? 'is' : 'is not'} currently earning fees</li>
              <li>Expected to be in range {formatPercent(result.timeInRange, false)} of the time</li>
              <li>Consider rebalancing if price moves significantly outside your range</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

interface ResultCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  subValue: string;
  positive?: boolean;
  negative?: boolean;
}

function ResultCard({ icon, label, value, subValue, positive, negative }: ResultCardProps) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-muted mb-2">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <p className={cn(
        'text-xl font-semibold',
        positive && 'text-success',
        negative && 'text-danger'
      )}>
        {negative && !positive && '-'}{value}
      </p>
      <p className="text-xs text-muted mt-1">{subValue}</p>
    </Card>
  );
}
