'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Pool } from '@/types';
import { fetchPoolById } from '@/lib/api';
import PoolSelectionView from '@/components/simulate/PoolSelectionView';
import { SimulationView } from '@/components/simulate/SimulationView';

function SimulateContent() {
  const searchParams = useSearchParams();
  const poolId = searchParams.get('pool');
  const [selectedPool, setSelectedPool] = useState<Pool | null>(null);

  // Load pool from URL param
  useEffect(() => {
    if (poolId) {
      fetchPoolById(poolId).then((pool) => {
        if (pool) setSelectedPool(pool);
      });
    }
  }, [poolId]);

  const handlePoolSelect = (pool: Pool) => {
    setSelectedPool(pool);
    // Update URL without full navigation
    const url = new URL(window.location.href);
    url.searchParams.set('pool', pool.id);
    window.history.pushState({}, '', url.toString());
  };

  const handleChangePool = () => {
    setSelectedPool(null);
    const url = new URL(window.location.href);
    url.searchParams.delete('pool');
    window.history.pushState({}, '', url.toString());
  };

  if (selectedPool) {
    return <SimulationView pool={selectedPool} onChangePool={handleChangePool} />;
  }

  return <PoolSelectionView onPoolSelect={handlePoolSelect} />;
}

export default function SimulatePage() {
  return (
    <Suspense fallback={<div className="max-w-7xl mx-auto px-4 py-6 text-muted">Loading...</div>}>
      <SimulateContent />
    </Suspense>
  );
}
