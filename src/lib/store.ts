import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Pool, Position, Exchange, Network, SimulationParams } from '@/types';
import { EXCHANGES } from './constants';
import { Language } from './i18n';

interface AppState {
  // Exchange & Network selection
  selectedExchange: Exchange;
  selectedNetwork: Network;
  setSelectedExchange: (exchange: Exchange) => void;
  setSelectedNetwork: (network: Network) => void;

  // Pool selection
  selectedPool: Pool | null;
  setSelectedPool: (pool: Pool | null) => void;
  recentlyViewedPools: Pool[];
  addRecentlyViewedPool: (pool: Pool) => void;

  // Simulation
  simulationParams: SimulationParams;
  setSimulationParams: (params: Partial<SimulationParams>) => void;

  // Tracked positions
  trackedPositions: Position[];
  addTrackedPosition: (position: Position) => void;
  removeTrackedPosition: (positionId: string) => void;

  // UI State
  isAuthModalOpen: boolean;
  setAuthModalOpen: (open: boolean) => void;
  isPro: boolean;
  setIsPro: (isPro: boolean) => void;

  // Search
  searchQuery: string;
  setSearchQuery: (query: string) => void;

  // Language
  language: Language;
  setLanguage: (language: Language) => void;
}

const defaultExchange = EXCHANGES[0];
const defaultNetwork = defaultExchange.networks[0];

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      // Exchange & Network
      selectedExchange: defaultExchange,
      selectedNetwork: defaultNetwork,
      setSelectedExchange: (exchange) =>
        set({
          selectedExchange: exchange,
          selectedNetwork: exchange.networks[0],
        }),
      setSelectedNetwork: (network) => set({ selectedNetwork: network }),

      // Pool selection
      selectedPool: null,
      setSelectedPool: (pool) => set({ selectedPool: pool }),
      recentlyViewedPools: [],
      addRecentlyViewedPool: (pool) =>
        set((state) => ({
          recentlyViewedPools: [
            pool,
            ...state.recentlyViewedPools.filter((p) => p.id !== pool.id),
          ].slice(0, 10),
        })),

      // Simulation
      simulationParams: {
        pool: null,
        depositAmount: 1000,
        priceRangeLower: 0,
        priceRangeUpper: 0,
        daysToSimulate: 30,
      },
      setSimulationParams: (params) =>
        set((state) => ({
          simulationParams: { ...state.simulationParams, ...params },
        })),

      // Tracked positions
      trackedPositions: [],
      addTrackedPosition: (position) =>
        set((state) => ({
          trackedPositions: [...state.trackedPositions, position],
        })),
      removeTrackedPosition: (positionId) =>
        set((state) => ({
          trackedPositions: state.trackedPositions.filter(
            (p) => p.id !== positionId
          ),
        })),

      // UI State
      isAuthModalOpen: false,
      setAuthModalOpen: (open) => set({ isAuthModalOpen: open }),
      isPro: false,
      setIsPro: (isPro) => set({ isPro }),

      // Search
      searchQuery: '',
      setSearchQuery: (query) => set({ searchQuery: query }),

      // Language
      language: 'en',
      setLanguage: (language) => set({ language }),
    }),
    {
      name: 'metrix-storage',
      partialize: (state) => ({
        recentlyViewedPools: state.recentlyViewedPools,
        trackedPositions: state.trackedPositions,
        isPro: state.isPro,
        language: state.language,
      }),
    }
  )
);
