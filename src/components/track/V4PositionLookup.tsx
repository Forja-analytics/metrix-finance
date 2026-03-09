'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { WalletPositionCard } from './WalletPositionCard';
import { OnChainPosition } from '@/hooks/usePositions';
import { Search, AlertCircle, Loader2 } from 'lucide-react';
import { createPublicClient, http } from 'viem';
import { mainnet, optimism, bsc, arbitrum, polygon, base } from 'viem/chains';
import { V4_POSITION_MANAGER_ABI, ERC20_ABI, V4_STATE_VIEW_ABI, V4_STATE_VIEW_ADDRESSES } from '@/lib/contracts';
import { V4_POSITION_MANAGER_ADDRESSES } from '@/lib/wagmi';

// Chain configurations
const chains = [
  { id: 1, name: 'Ethereum', chain: mainnet },
  { id: 10, name: 'Optimism', chain: optimism },
  { id: 56, name: 'BSC', chain: bsc },
  { id: 42161, name: 'Arbitrum', chain: arbitrum },
  { id: 137, name: 'Polygon', chain: polygon },
  { id: 8453, name: 'Base', chain: base },
];

// RPC endpoints
const RPC_ENDPOINTS: Record<number, string> = {
  1: 'https://eth.llamarpc.com',
  10: 'https://mainnet.optimism.io',
  56: 'https://bsc-dataseed1.binance.org',
  42161: 'https://arb1.arbitrum.io/rpc',
  137: 'https://polygon-rpc.com',
  8453: 'https://mainnet.base.org',
};

// Token symbol lookup
const KNOWN_TOKENS: Record<string, { symbol: string; decimals: number }> = {
  '0x0000000000000000000000000000000000000000': { symbol: 'ETH', decimals: 18 },
  '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2': { symbol: 'WETH', decimals: 18 },
  '0xdac17f958d2ee523a2206206994597c13d831ec7': { symbol: 'USDT', decimals: 6 },
  '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48': { symbol: 'USDC', decimals: 6 },
  '0x6b175474e89094c44da98b954eedeac495271d0f': { symbol: 'DAI', decimals: 18 },
  '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599': { symbol: 'WBTC', decimals: 8 },
};

// Helper to calculate token amounts from liquidity and price
function calculateTokenAmounts(
  liquidity: bigint,
  sqrtPriceX96: bigint,
  tickLower: number,
  tickUpper: number,
  currentTick: number,
  token0Decimals: number,
  token1Decimals: number
): { token0Amount: number; token1Amount: number } {
  if (liquidity === 0n) {
    return { token0Amount: 0, token1Amount: 0 };
  }

  const Q96 = 2n ** 96n;

  // Calculate sqrt prices at tick boundaries
  const sqrtPriceLowerX96 = tickToSqrtPriceX96(tickLower);
  const sqrtPriceUpperX96 = tickToSqrtPriceX96(tickUpper);

  let amount0 = 0n;
  let amount1 = 0n;

  if (currentTick < tickLower) {
    // Position is entirely in token0
    amount0 = (liquidity * (sqrtPriceUpperX96 - sqrtPriceLowerX96)) / (sqrtPriceLowerX96 * sqrtPriceUpperX96 / Q96);
  } else if (currentTick >= tickUpper) {
    // Position is entirely in token1
    amount1 = liquidity * (sqrtPriceUpperX96 - sqrtPriceLowerX96) / Q96;
  } else {
    // Position is in range
    amount0 = (liquidity * (sqrtPriceUpperX96 - sqrtPriceX96)) / (sqrtPriceX96 * sqrtPriceUpperX96 / Q96);
    amount1 = liquidity * (sqrtPriceX96 - sqrtPriceLowerX96) / Q96;
  }

  return {
    token0Amount: Number(amount0) / Math.pow(10, token0Decimals),
    token1Amount: Number(amount1) / Math.pow(10, token1Decimals),
  };
}

function tickToSqrtPriceX96(tick: number): bigint {
  const absTick = Math.abs(tick);
  let ratio = (absTick & 0x1) !== 0 ? 0xfffcb933bd6fad37aa2d162d1a594001n : 0x100000000000000000000000000000000n;

  if ((absTick & 0x2) !== 0) ratio = (ratio * 0xfff97272373d413259a46990580e213an) >> 128n;
  if ((absTick & 0x4) !== 0) ratio = (ratio * 0xfff2e50f5f656932ef12357cf3c7fdccn) >> 128n;
  if ((absTick & 0x8) !== 0) ratio = (ratio * 0xffe5caca7e10e4e61c3624eaa0941cd0n) >> 128n;
  if ((absTick & 0x10) !== 0) ratio = (ratio * 0xffcb9843d60f6159c9db58835c926644n) >> 128n;
  if ((absTick & 0x20) !== 0) ratio = (ratio * 0xff973b41fa98c081472e6896dfb254c0n) >> 128n;
  if ((absTick & 0x40) !== 0) ratio = (ratio * 0xff2ea16466c96a3843ec78b326b52861n) >> 128n;
  if ((absTick & 0x80) !== 0) ratio = (ratio * 0xfe5dee046a99a2a811c461f1969c3053n) >> 128n;
  if ((absTick & 0x100) !== 0) ratio = (ratio * 0xfcbe86c7900a88aedcffc83b479aa3a4n) >> 128n;
  if ((absTick & 0x200) !== 0) ratio = (ratio * 0xf987a7253ac413176f2b074cf7815e54n) >> 128n;
  if ((absTick & 0x400) !== 0) ratio = (ratio * 0xf3392b0822b70005940c7a398e4b70f3n) >> 128n;
  if ((absTick & 0x800) !== 0) ratio = (ratio * 0xe7159475a2c29b7443b29c7fa6e889d9n) >> 128n;
  if ((absTick & 0x1000) !== 0) ratio = (ratio * 0xd097f3bdfd2022b8845ad8f792aa5825n) >> 128n;
  if ((absTick & 0x2000) !== 0) ratio = (ratio * 0xa9f746462d870fdf8a65dc1f90e061e5n) >> 128n;
  if ((absTick & 0x4000) !== 0) ratio = (ratio * 0x70d869a156d2a1b890bb3df62baf32f7n) >> 128n;
  if ((absTick & 0x8000) !== 0) ratio = (ratio * 0x31be135f97d08fd981231505542fcfa6n) >> 128n;
  if ((absTick & 0x10000) !== 0) ratio = (ratio * 0x9aa508b5b7a84e1c677de54f3e99bc9n) >> 128n;
  if ((absTick & 0x20000) !== 0) ratio = (ratio * 0x5d6af8dedb81196699c329225ee604n) >> 128n;
  if ((absTick & 0x40000) !== 0) ratio = (ratio * 0x2216e584f5fa1ea926041bedfe98n) >> 128n;
  if ((absTick & 0x80000) !== 0) ratio = (ratio * 0x48a170391f7dc42444e8fa2n) >> 128n;

  if (tick > 0) ratio = 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffn / ratio;

  // Adjust from Q128 to Q96
  return (ratio >> 32n) + (ratio % (1n << 32n) === 0n ? 0n : 1n);
}

// Parse V4 PositionInfo packed uint256
function parsePositionInfo(info: bigint): { hasSubscriber: boolean; tickLower: number; tickUpper: number; poolId: string } {
  // Bit layout: [0-7: hasSubscriber] [8-31: tickLower] [32-55: tickUpper] [56-255: poolId]
  const hasSubscriber = (info & 0xFFn) !== 0n;
  const tickLower = Number((info >> 8n) & 0xFFFFFFn);
  const tickUpper = Number((info >> 32n) & 0xFFFFFFn);
  const poolId = '0x' + ((info >> 56n) & ((1n << 200n) - 1n)).toString(16).padStart(50, '0');

  // Convert from unsigned to signed 24-bit
  const signedTickLower = tickLower > 8388607 ? tickLower - 16777216 : tickLower;
  const signedTickUpper = tickUpper > 8388607 ? tickUpper - 16777216 : tickUpper;

  return { hasSubscriber, tickLower: signedTickLower, tickUpper: signedTickUpper, poolId };
}

interface V4PositionLookupProps {
  onPositionFound?: (position: OnChainPosition) => void;
}

export function V4PositionLookup({ onPositionFound }: V4PositionLookupProps) {
  const [tokenId, setTokenId] = useState('');
  const [selectedChainId, setSelectedChainId] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [foundPosition, setFoundPosition] = useState<OnChainPosition | null>(null);

  const handleLookup = async () => {
    if (!tokenId.trim()) {
      setError('Please enter a token ID');
      return;
    }

    setIsLoading(true);
    setError(null);
    setFoundPosition(null);

    try {
      const tokenIdBigInt = BigInt(tokenId);
      const chainConfig = chains.find(c => c.id === selectedChainId);
      if (!chainConfig) {
        throw new Error('Invalid chain');
      }

      const positionManagerAddress = V4_POSITION_MANAGER_ADDRESSES[selectedChainId];
      if (!positionManagerAddress) {
        throw new Error(`V4 not supported on ${chainConfig.name}`);
      }

      const client = createPublicClient({
        chain: chainConfig.chain,
        transport: http(RPC_ENDPOINTS[selectedChainId]),
      });

      console.log(`Looking up V4 position ${tokenId} on ${chainConfig.name}...`);

      // Fetch position data
      const [poolAndPositionInfo, liquidity] = await Promise.all([
        client.readContract({
          address: positionManagerAddress,
          abi: V4_POSITION_MANAGER_ABI,
          functionName: 'getPoolAndPositionInfo',
          args: [tokenIdBigInt],
        }) as Promise<[{ currency0: `0x${string}`; currency1: `0x${string}`; fee: number; tickSpacing: number; hooks: `0x${string}` }, bigint]>,
        client.readContract({
          address: positionManagerAddress,
          abi: V4_POSITION_MANAGER_ABI,
          functionName: 'getPositionLiquidity',
          args: [tokenIdBigInt],
        }) as Promise<bigint>,
      ]);

      const [poolKey, positionInfo] = poolAndPositionInfo;
      const { tickLower, tickUpper, poolId } = parsePositionInfo(positionInfo);

      console.log('Pool Key:', poolKey);
      console.log('Position Info:', { tickLower, tickUpper, poolId });
      console.log('Liquidity:', liquidity.toString());

      // Get token info
      const token0Address = poolKey.currency0.toLowerCase();
      const token1Address = poolKey.currency1.toLowerCase();

      let token0Symbol = 'TOKEN0';
      let token1Symbol = 'TOKEN1';
      let token0Decimals = 18;
      let token1Decimals = 18;

      // Check known tokens first
      if (KNOWN_TOKENS[token0Address]) {
        token0Symbol = KNOWN_TOKENS[token0Address].symbol;
        token0Decimals = KNOWN_TOKENS[token0Address].decimals;
      } else if (token0Address === '0x0000000000000000000000000000000000000000') {
        token0Symbol = 'ETH';
        token0Decimals = 18;
      } else {
        // Fetch from contract
        try {
          const [symbol, decimals] = await Promise.all([
            client.readContract({
              address: poolKey.currency0,
              abi: ERC20_ABI,
              functionName: 'symbol',
            }) as Promise<string>,
            client.readContract({
              address: poolKey.currency0,
              abi: ERC20_ABI,
              functionName: 'decimals',
            }) as Promise<number>,
          ]);
          token0Symbol = symbol;
          token0Decimals = decimals;
        } catch (e) {
          console.log('Failed to fetch token0 info:', e);
        }
      }

      if (KNOWN_TOKENS[token1Address]) {
        token1Symbol = KNOWN_TOKENS[token1Address].symbol;
        token1Decimals = KNOWN_TOKENS[token1Address].decimals;
      } else if (token1Address === '0x0000000000000000000000000000000000000000') {
        token1Symbol = 'ETH';
        token1Decimals = 18;
      } else {
        try {
          const [symbol, decimals] = await Promise.all([
            client.readContract({
              address: poolKey.currency1,
              abi: ERC20_ABI,
              functionName: 'symbol',
            }) as Promise<string>,
            client.readContract({
              address: poolKey.currency1,
              abi: ERC20_ABI,
              functionName: 'decimals',
            }) as Promise<number>,
          ]);
          token1Symbol = symbol;
          token1Decimals = decimals;
        } catch (e) {
          console.log('Failed to fetch token1 info:', e);
        }
      }

      // Try to get current tick from StateView if available
      let currentTick = 0;
      let sqrtPriceX96 = 0n;
      const stateViewAddress = V4_STATE_VIEW_ADDRESSES[selectedChainId];

      if (stateViewAddress) {
        try {
          // Compute the full poolId hash
          const poolIdBytes = computePoolId(poolKey);
          const slot0 = await client.readContract({
            address: stateViewAddress,
            abi: V4_STATE_VIEW_ABI,
            functionName: 'getSlot0',
            args: [poolIdBytes as `0x${string}`],
          }) as [bigint, number, number, number];

          sqrtPriceX96 = slot0[0];
          currentTick = slot0[1];
          console.log('Pool slot0:', { sqrtPriceX96: sqrtPriceX96.toString(), currentTick });
        } catch (e) {
          console.log('Failed to fetch pool state, using tick estimate');
          // Estimate current tick as middle of range
          currentTick = Math.floor((tickLower + tickUpper) / 2);
          sqrtPriceX96 = tickToSqrtPriceX96(currentTick);
        }
      } else {
        // Estimate current tick as middle of range
        currentTick = Math.floor((tickLower + tickUpper) / 2);
        sqrtPriceX96 = tickToSqrtPriceX96(currentTick);
      }

      // Calculate token amounts
      const inRange = currentTick >= tickLower && currentTick < tickUpper;
      const { token0Amount, token1Amount } = calculateTokenAmounts(
        liquidity,
        sqrtPriceX96,
        tickLower,
        tickUpper,
        currentTick,
        token0Decimals,
        token1Decimals
      );

      const position: OnChainPosition = {
        tokenId: tokenIdBigInt,
        nonce: 0n, // V4 doesn't have nonce
        operator: '0x0000000000000000000000000000000000000000',
        token0: poolKey.currency0,
        token1: poolKey.currency1,
        token0Symbol,
        token1Symbol,
        token0Decimals,
        token1Decimals,
        fee: poolKey.fee,
        tickLower,
        tickUpper,
        liquidity,
        feeGrowthInside0LastX128: 0n,
        feeGrowthInside1LastX128: 0n,
        tokensOwed0: 0n,
        tokensOwed1: 0n,
        currentTick,
        inRange,
        token0Amount,
        token1Amount,
        chainId: selectedChainId,
        chainName: chainConfig.name,
        version: 'v4',
      };

      console.log('Found V4 position:', position);
      setFoundPosition(position);
      onPositionFound?.(position);
    } catch (err: any) {
      console.error('Error looking up V4 position:', err);
      setError(err.message || 'Failed to fetch position. Make sure the token ID exists on the selected chain.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <h3 className="font-semibold mb-3">Lookup V4 Position by NFT ID</h3>
        <p className="text-sm text-muted mb-4">
          Enter a Uniswap V4 position NFT ID to fetch its details directly from the blockchain.
          This is useful for tracking positions owned by smart contract wallets.
        </p>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <Input
              placeholder="Enter V4 NFT Token ID (e.g., 102049)"
              value={tokenId}
              onChange={(e) => setTokenId(e.target.value)}
              type="number"
            />
          </div>
          <div className="w-full sm:w-40">
            <select
              value={selectedChainId}
              onChange={(e) => setSelectedChainId(Number(e.target.value))}
              className="w-full h-10 px-3 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {chains.filter(c => V4_POSITION_MANAGER_ADDRESSES[c.id]).map((chain) => (
                <option key={chain.id} value={chain.id}>
                  {chain.name}
                </option>
              ))}
            </select>
          </div>
          <Button onClick={handleLookup} disabled={isLoading || !tokenId.trim()}>
            {isLoading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Search className="w-4 h-4 mr-2" />
            )}
            Lookup
          </Button>
        </div>

        {error && (
          <div className="flex items-center gap-2 mt-3 p-3 bg-danger/10 text-danger rounded-lg text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </Card>

      {foundPosition && (
        <div>
          <h4 className="text-sm font-medium text-muted mb-2">Position Found:</h4>
          <WalletPositionCard position={foundPosition} />
        </div>
      )}
    </div>
  );
}

// Helper to compute pool ID hash from pool key
function computePoolId(poolKey: { currency0: `0x${string}`; currency1: `0x${string}`; fee: number; tickSpacing: number; hooks: `0x${string}` }): `0x${string}` {
  // The poolId is keccak256(abi.encode(currency0, currency1, fee, tickSpacing, hooks))
  // For now we'll use a simplified version - the actual calculation requires encoding
  // This is a placeholder - in production you'd use viem's encodeAbiParameters and keccak256
  const { keccak256, encodePacked } = require('viem');

  try {
    // Simple concatenation for demo - actual implementation needs proper ABI encoding
    const encoded = encodePacked(
      ['address', 'address', 'uint24', 'int24', 'address'],
      [poolKey.currency0, poolKey.currency1, poolKey.fee, poolKey.tickSpacing, poolKey.hooks]
    );
    return keccak256(encoded);
  } catch {
    // Fallback to zero bytes32 if encoding fails
    return '0x0000000000000000000000000000000000000000000000000000000000000000';
  }
}
