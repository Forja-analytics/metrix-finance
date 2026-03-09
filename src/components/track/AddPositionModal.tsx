'use client';

import { useState } from 'react';
import { X, Search, Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Position, Pool } from '@/types';
import { fetchPools } from '@/lib/api';
import { useStore } from '@/lib/store';

interface AddPositionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (position: Position) => void;
}

export function AddPositionModal({ isOpen, onClose, onAdd }: AddPositionModalProps) {
  const [step, setStep] = useState<'pool' | 'details'>('pool');
  const [pools, setPools] = useState<Pool[]>([]);
  const [selectedPool, setSelectedPool] = useState<Pool | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [positionId, setPositionId] = useState('');
  const [depositAmount, setDepositAmount] = useState('');
  const { selectedExchange, selectedNetwork } = useStore();

  const loadPools = async () => {
    const data = await fetchPools(selectedExchange.id, selectedNetwork.id);
    setPools(data);
  };

  useState(() => {
    if (isOpen) {
      loadPools();
    }
  });

  if (!isOpen) return null;

  const filteredPools = pools.filter(
    (pool) =>
      pool.token0.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pool.token1.symbol.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAddPosition = () => {
    if (!selectedPool || !positionId || !depositAmount) return;

    const deposit = parseFloat(depositAmount);
    const mockPosition: Position = {
      id: positionId,
      pool: selectedPool,
      tickLower: -887220,
      tickUpper: 887220,
      liquidity: '1000000000000000000',
      token0Amount: deposit / 2 / (selectedPool.token0.price || 1),
      token1Amount: deposit / 2 / (selectedPool.token1.price || 1),
      uncollectedFees0: 0,
      uncollectedFees1: 0,
      depositedToken0: deposit / 2 / (selectedPool.token0.price || 1),
      depositedToken1: deposit / 2 / (selectedPool.token1.price || 1),
      depositedUSD: deposit,
      currentValueUSD: deposit * 1.05,
      pnl: deposit * 0.08,
      pnlPercentage: 8,
      feesEarnedUSD: deposit * 0.03,
      createdAt: new Date().toISOString(),
    };

    onAdd(mockPosition);
    resetForm();
    onClose();
  };

  const resetForm = () => {
    setStep('pool');
    setSelectedPool(null);
    setSearchQuery('');
    setPositionId('');
    setDepositAmount('');
  };

  const tokenColors: Record<string, string> = {
    ETH: '#627eea',
    USDC: '#2775ca',
    USDT: '#26a17b',
    WBTC: '#f7931a',
    DAI: '#f5ac37',
    LINK: '#2a5ada',
    UNI: '#ff007a',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-lg mx-4 bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
        <div className="p-6 pb-0 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">
              {step === 'pool' ? 'Select Pool' : 'Position Details'}
            </h2>
            <p className="text-sm text-muted mt-1">
              {step === 'pool' ? 'Choose a liquidity pool to track' : 'Enter your position information'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-muted hover:text-foreground hover:bg-card-hover rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {step === 'pool' ? (
            <>
              <div className="mb-4">
                <Input
                  placeholder="Search pools..."
                  icon={<Search className="w-4 h-4" />}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="max-h-64 overflow-y-auto space-y-2">
                {filteredPools.map((pool) => (
                  <button
                    key={pool.id}
                    onClick={() => {
                      setSelectedPool(pool);
                      setStep('details');
                    }}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg hover:bg-card-hover transition-colors ${
                      selectedPool?.id === pool.id ? 'bg-primary/10 border border-primary' : 'border border-border'
                    }`}
                  >
                    <div className="flex -space-x-2">
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white border-2 border-card"
                        style={{ backgroundColor: tokenColors[pool.token0.symbol] || '#6366f1' }}
                      >
                        {pool.token0.symbol.charAt(0)}
                      </div>
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white border-2 border-card"
                        style={{ backgroundColor: tokenColors[pool.token1.symbol] || '#6366f1' }}
                      >
                        {pool.token1.symbol.charAt(0)}
                      </div>
                    </div>
                    <div className="flex-1 text-left">
                      <span className="font-medium">
                        {pool.token0.symbol}/{pool.token1.symbol}
                      </span>
                      <span className="text-xs text-muted block">
                        {pool.feeTier / 10000}% fee • {pool.network}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="space-y-4">
              {/* Selected Pool Display */}
              {selectedPool && (
                <div className="flex items-center gap-3 p-3 bg-background rounded-lg">
                  <div className="flex -space-x-2">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white border-2 border-background"
                      style={{ backgroundColor: tokenColors[selectedPool.token0.symbol] || '#6366f1' }}
                    >
                      {selectedPool.token0.symbol.charAt(0)}
                    </div>
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white border-2 border-background"
                      style={{ backgroundColor: tokenColors[selectedPool.token1.symbol] || '#6366f1' }}
                    >
                      {selectedPool.token1.symbol.charAt(0)}
                    </div>
                  </div>
                  <div>
                    <span className="font-medium">
                      {selectedPool.token0.symbol}/{selectedPool.token1.symbol}
                    </span>
                    <span className="text-xs text-muted block">
                      {selectedPool.feeTier / 10000}% fee
                    </span>
                  </div>
                  <button
                    onClick={() => setStep('pool')}
                    className="ml-auto text-xs text-primary hover:underline"
                  >
                    Change
                  </button>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-1.5">Position ID / NFT ID</label>
                <Input
                  placeholder="Enter position ID"
                  value={positionId}
                  onChange={(e) => setPositionId(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">Deposited Amount (USD)</label>
                <Input
                  type="number"
                  placeholder="Enter amount"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                />
              </div>

              <Button
                onClick={handleAddPosition}
                disabled={!positionId || !depositAmount}
                className="w-full"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Position
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
