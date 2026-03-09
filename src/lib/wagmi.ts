import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { mainnet, arbitrum, polygon, optimism, base, bsc } from 'wagmi/chains';
import { http } from 'wagmi';

const alchemyKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;

// Use public RPC endpoints if Alchemy key is not properly configured
const hasValidAlchemyKey = alchemyKey && alchemyKey.length > 20 && alchemyKey !== 'demo';

export const config = getDefaultConfig({
  appName: 'Metrix Finance',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'demo-project-id',
  chains: [mainnet, arbitrum, polygon, optimism, base, bsc],
  transports: {
    [mainnet.id]: http(hasValidAlchemyKey
      ? `https://eth-mainnet.g.alchemy.com/v2/${alchemyKey}`
      : 'https://eth.llamarpc.com'),
    [arbitrum.id]: http(hasValidAlchemyKey
      ? `https://arb-mainnet.g.alchemy.com/v2/${alchemyKey}`
      : 'https://arbitrum.drpc.org'),
    [polygon.id]: http(hasValidAlchemyKey
      ? `https://polygon-mainnet.g.alchemy.com/v2/${alchemyKey}`
      : 'https://polygon.drpc.org'),
    [optimism.id]: http(hasValidAlchemyKey
      ? `https://opt-mainnet.g.alchemy.com/v2/${alchemyKey}`
      : 'https://optimism.drpc.org'),
    [base.id]: http(hasValidAlchemyKey
      ? `https://base-mainnet.g.alchemy.com/v2/${alchemyKey}`
      : 'https://base.drpc.org'),
    [bsc.id]: http('https://bsc-dataseed.binance.org'),
  },
  ssr: true,
});

// Uniswap V3 NonfungiblePositionManager addresses by chain
export const POSITION_MANAGER_ADDRESSES: Record<number, `0x${string}`> = {
  1: '0xC36442b4a4522E871399CD717aBDD847Ab11FE88', // Ethereum
  42161: '0xC36442b4a4522E871399CD717aBDD847Ab11FE88', // Arbitrum
  137: '0xC36442b4a4522E871399CD717aBDD847Ab11FE88', // Polygon
  10: '0xC36442b4a4522E871399CD717aBDD847Ab11FE88', // Optimism
  8453: '0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1', // Base
  56: '0x7b8A01B39D58278b5DE7e48c8449c9f4F5170613', // BSC
};

// Uniswap V3 Factory addresses
export const FACTORY_ADDRESSES: Record<number, `0x${string}`> = {
  1: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
  42161: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
  137: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
  10: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
  8453: '0x33128a8fC17869897dcE68Ed026d694621f6FDfD',
  56: '0xdB1d10011AD0Ff90774D0C6Bb92e5C5c8b4461F7', // BSC
};

// Uniswap V4 PoolManager addresses by chain
export const V4_POOL_MANAGER_ADDRESSES: Record<number, `0x${string}`> = {
  1: '0x000000000004444c5dc75cb358380d2e3de08a90', // Ethereum
  10: '0x9a13f98cb987694c9f086b1f5eb990eea8264ec3', // Optimism
  56: '0x28e2ea090877bf75740558f6bfb36a5ffee9e9df', // BSC
};

// Uniswap V4 Position Manager addresses by chain
export const V4_POSITION_MANAGER_ADDRESSES: Record<number, `0x${string}`> = {
  1: '0xbd216513d74c8cf14cf4747e6aaa6420ff64ee9e', // Ethereum
  10: '0x3c3ea4b57a46241e54610e5f022e5c45859a1017', // Optimism
  56: '0x7a4a5c919ae2541aed11041a1aeee68f1287f95b', // BSC
  42161: '0xd88f38f937952f2db2432cb002e7abbf3dd869', // Arbitrum
  137: '0x1ec2ebf4f37e7363fdfe3551602425af0b3ceef9', // Polygon
  8453: '0x7c5f5a4bbd8fd63184577525326123b519429bdc', // Base
};
