import { Exchange, Network } from '@/types';

export const EXCHANGES: Exchange[] = [
  {
    id: 'uniswap-v3',
    name: 'Uniswap V3',
    logo: '/exchanges/uniswap.svg',
    networks: [
      { id: 'ethereum', name: 'Ethereum', chainId: 1, logo: '/networks/ethereum.svg' },
      { id: 'arbitrum', name: 'Arbitrum', chainId: 42161, logo: '/networks/arbitrum.svg' },
      { id: 'polygon', name: 'Polygon', chainId: 137, logo: '/networks/polygon.svg' },
      { id: 'optimism', name: 'Optimism', chainId: 10, logo: '/networks/optimism.svg' },
      { id: 'base', name: 'Base', chainId: 8453, logo: '/networks/base.svg' },
    ],
  },
  {
    id: 'pancakeswap-v3',
    name: 'PancakeSwap V3',
    logo: '/exchanges/pancakeswap.svg',
    networks: [
      { id: 'bsc', name: 'BNB Chain', chainId: 56, logo: '/networks/bnb.svg' },
      { id: 'ethereum', name: 'Ethereum', chainId: 1, logo: '/networks/ethereum.svg' },
      { id: 'arbitrum', name: 'Arbitrum', chainId: 42161, logo: '/networks/arbitrum.svg' },
    ],
  },
  {
    id: 'sushiswap-v3',
    name: 'SushiSwap V3',
    logo: '/exchanges/sushiswap.svg',
    networks: [
      { id: 'ethereum', name: 'Ethereum', chainId: 1, logo: '/networks/ethereum.svg' },
      { id: 'arbitrum', name: 'Arbitrum', chainId: 42161, logo: '/networks/arbitrum.svg' },
      { id: 'polygon', name: 'Polygon', chainId: 137, logo: '/networks/polygon.svg' },
    ],
  },
];

export const NETWORKS: Network[] = [
  { id: 'ethereum', name: 'Ethereum', chainId: 1, logo: '/networks/ethereum.png' },
  { id: 'arbitrum', name: 'Arbitrum', chainId: 42161, logo: '/networks/arbitrum.svg' },
  { id: 'polygon', name: 'Polygon', chainId: 137, logo: '/networks/polygon.png' },
  { id: 'optimism', name: 'Optimism', chainId: 10, logo: '/networks/optimism.svg' },
  { id: 'base', name: 'Base', chainId: 8453, logo: '/networks/base.png' },
  { id: 'bsc', name: 'BNB Chain', chainId: 56, logo: '/networks/bnb.svg' },
];

export const FEE_TIERS = [
  { value: 100, label: '0.01%', description: 'Best for stable pairs' },
  { value: 500, label: '0.05%', description: 'Best for stable pairs' },
  { value: 3000, label: '0.30%', description: 'Best for most pairs' },
  { value: 10000, label: '1.00%', description: 'Best for exotic pairs' },
];

export const POPULAR_TOKENS = [
  { symbol: 'ETH', name: 'Ethereum', address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2' },
  { symbol: 'USDC', name: 'USD Coin', address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' },
  { symbol: 'USDT', name: 'Tether', address: '0xdAC17F958D2ee523a2206206994597C13D831ec7' },
  { symbol: 'WBTC', name: 'Wrapped Bitcoin', address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599' },
  { symbol: 'DAI', name: 'Dai', address: '0x6B175474E89094C44Da98b954EesNcdBC2aFd3db' },
  { symbol: 'LINK', name: 'Chainlink', address: '0x514910771AF9Ca656af840dff83E8264EcF986CA' },
  { symbol: 'UNI', name: 'Uniswap', address: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984' },
];

export const API_ENDPOINTS = {
  COINGECKO: 'https://api.coingecko.com/api/v3',
  DEFILLAMA: 'https://api.llama.fi',
  UNISWAP_GRAPH: 'https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3',
};

export const FEAR_GREED_LABELS: Record<string, { label: string; color: string }> = {
  '0-25': { label: 'Extreme Fear', color: '#ef4444' },
  '25-45': { label: 'Fear', color: '#f97316' },
  '45-55': { label: 'Neutral', color: '#eab308' },
  '55-75': { label: 'Greed', color: '#84cc16' },
  '75-100': { label: 'Extreme Greed', color: '#22c55e' },
};

// Pool blocklist - these pools should be excluded from all queries and displays
// ease.org pools are from a different protocol and should not appear in Uniswap-focused views
export const EXCLUDED_POOL_IDENTIFIERS = [
  'ease.org/ez-cvxsteCRV',
  'ease.org/ez-yvCurve-IronBank',
  'ease.org/ez-SLP-WBTC-WETH',
];

export function getFearGreedLabel(value: number): { label: string; color: string } {
  if (value <= 25) return FEAR_GREED_LABELS['0-25'];
  if (value <= 45) return FEAR_GREED_LABELS['25-45'];
  if (value <= 55) return FEAR_GREED_LABELS['45-55'];
  if (value <= 75) return FEAR_GREED_LABELS['55-75'];
  return FEAR_GREED_LABELS['75-100'];
}
