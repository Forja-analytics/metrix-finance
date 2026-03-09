'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { SimulationForm } from '@/components/simulate/SimulationForm';
import { SimulationResults } from '@/components/simulate/SimulationResults';
import { PoolSearchSelector } from '@/components/simulate/PoolSearchSelector';
import { Pool, SimulationResult } from '@/types';
import { fetchPoolById, fetchPools } from '@/lib/api';
import { useStore } from '@/lib/store';
import { useTranslation } from '@/hooks/useTranslation';
import { Sidebar } from '@/components/layout/Sidebar';
import { BarChart3 } from 'lucide-react';

function SimulateContent() {
  const t = useTranslation();
  const searchParams = useSearchParams();
  const poolId = searchParams.get('pool');
  const [selectedPool, setSelectedPool] = useState<Pool | null>(null);
  const [simulationResult, setSimulationResult] = useState<SimulationResult | null>(null);
  const [availablePools, setAvailablePools] = useState<Pool[]>([]);
  const [isLoadingPools, setIsLoadingPools] = useState(true);
  const { selectedExchange, selectedNetwork } = useStore();

  useEffect(() => {
    async function loadPool() {
      if (poolId) {
        const pool = await fetchPoolById(poolId);
        setSelectedPool(pool);
      }
    }
    loadPool();
  }, [poolId]);

  useEffect(() => {
    async function loadPools() {
      setIsLoadingPools(true);
      try {
        const pools = await fetchPools(selectedExchange.id, selectedNetwork.id);
        setAvailablePools(pools);
        if (!selectedPool && pools.length > 0) {
          setSelectedPool(pools[0]);
        }
      } finally {
        setIsLoadingPools(false);
      }
    }
    loadPools();
  }, [selectedExchange.id, selectedNetwork.id, selectedPool]);

  const handlePoolSelect = (pool: Pool) => {
    setSelectedPool(pool);
    setSimulationResult(null);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-primary/10 rounded-lg">
            <BarChart3 className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">{t('simulateTitle')}</h1>
        </div>
        <p className="text-muted">
          {t('simulateSubtitle')}
        </p>
      </div>

      {/* Main Content */}
      <div className="flex gap-6">
        {/* Sidebar */}
        <Sidebar />

        {/* Main Area */}
        <div className="flex-1 space-y-6">
          {/* Pool Search Selector */}
          <div>
            <label className="block text-sm font-medium mb-3">{t('selectPool')}</label>
            <PoolSearchSelector
              pools={availablePools}
              selectedPool={selectedPool}
              onSelect={handlePoolSelect}
              isLoading={isLoadingPools}
            />
          </div>

          {/* Simulation Grid */}
          <div className="grid lg:grid-cols-2 gap-6">
            <SimulationForm pool={selectedPool} onSimulate={setSimulationResult} />
            <SimulationResults result={simulationResult} pool={selectedPool} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SimulatePage() {
  return (
    <Suspense fallback={<div className="max-w-7xl mx-auto px-4 py-6 text-muted">...</div>}>
      <SimulateContent />
    </Suspense>
  );
}
