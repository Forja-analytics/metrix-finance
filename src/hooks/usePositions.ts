'use client';

import { useAccount, useReadContract, useChainId, useConfig } from 'wagmi';
import { readContracts, readContract, getPublicClient } from 'wagmi/actions';
import { POSITION_MANAGER_ABI, ERC20_ABI, V4_POSITION_MANAGER_ABI, V4_STATE_VIEW_ABI, V4_STATE_VIEW_ADDRESSES, POOL_ABI, FACTORY_ABI } from '@/lib/contracts';
import { POSITION_MANAGER_ADDRESSES, V4_POSITION_MANAGER_ADDRESSES, FACTORY_ADDRESSES } from '@/lib/wagmi';
import { useState, useEffect, useCallback } from 'react';
import { fetchV4PositionTokenIds } from '@/lib/v4-subgraph';
import { keccak256, encodeAbiParameters, parseAbiParameters, getContractAddress, getCreate2Address, concat, pad, toHex } from 'viem';
import { mainnet, arbitrum, polygon, optimism, base, bsc } from 'wagmi/chains';

// All supported chains for multi-chain fetching
const SUPPORTED_CHAINS = [mainnet, arbitrum, polygon, optimism, base, bsc];

// V3 Pool init code hash (used to compute pool address)
const POOL_INIT_CODE_HASH = '0xe34f199b19b2b4f47f68442619d555527d244f78a3297ea89325f843f87b8b54' as const;

// Compute V3 pool address using CREATE2
function computeV3PoolAddress(
  factoryAddress: `0x${string}`,
  token0: `0x${string}`,
  token1: `0x${string}`,
  fee: number
): `0x${string}` {
  // Sort tokens to match Uniswap's ordering
  const [sortedToken0, sortedToken1] = token0.toLowerCase() < token1.toLowerCase()
    ? [token0, token1]
    : [token1, token0];

  // Encode the salt (keccak256 of token0, token1, fee)
  const salt = keccak256(
    encodeAbiParameters(
      parseAbiParameters('address, address, uint24'),
      [sortedToken0, sortedToken1, fee]
    )
  );

  // Compute CREATE2 address
  return getCreate2Address({
    from: factoryAddress,
    salt,
    bytecodeHash: POOL_INIT_CODE_HASH,
  });
}

// Helper function to decode packed PositionInfo (uint256)
// Bit layout: [0-7: hasSubscriber] [8-31: tickLower] [32-55: tickUpper] [56-255: poolId]
function decodePositionInfo(packedInfo: bigint): { tickLower: number; tickUpper: number } {
  // Extract tickLower from bits 8-31 (24 bits)
  const tickLowerRaw = Number((packedInfo >> 8n) & 0xFFFFFFn);
  // Sign extend from 24 bits to handle negative ticks
  const tickLower = tickLowerRaw > 0x7FFFFF ? tickLowerRaw - 0x1000000 : tickLowerRaw;

  // Extract tickUpper from bits 32-55 (24 bits)
  const tickUpperRaw = Number((packedInfo >> 32n) & 0xFFFFFFn);
  // Sign extend from 24 bits to handle negative ticks
  const tickUpper = tickUpperRaw > 0x7FFFFF ? tickUpperRaw - 0x1000000 : tickUpperRaw;

  return { tickLower, tickUpper };
}

// Compute poolId from poolKey (keccak256 of encoded poolKey)
function computePoolId(poolKey: {
  currency0: string;
  currency1: string;
  fee: number;
  tickSpacing: number;
  hooks: string;
}): `0x${string}` {
  const encoded = encodeAbiParameters(
    parseAbiParameters('address, address, uint24, int24, address'),
    [
      poolKey.currency0 as `0x${string}`,
      poolKey.currency1 as `0x${string}`,
      poolKey.fee,
      poolKey.tickSpacing,
      poolKey.hooks as `0x${string}`,
    ]
  );
  return keccak256(encoded);
}

// Calculate sqrtRatioX96 from tick using Uniswap's tick math
// Based on Uniswap V3's TickMath.getSqrtRatioAtTick
function tickToSqrtRatioX96(tick: number): bigint {
  const absTick = Math.abs(tick);

  // Lookup table approach similar to Uniswap
  // These are the magic numbers from Uniswap V3 TickMath
  let ratio = (absTick & 0x1) !== 0
    ? 0xfffcb933bd6fad37aa2d162d1a594001n
    : 0x100000000000000000000000000000000n;

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

  // If tick is positive, we need the reciprocal
  if (tick > 0) {
    ratio = 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffn / ratio;
  }

  // Convert from Q128 to Q96 (shift right by 32 bits)
  return ratio >> 32n;
}

// Calculate token amounts from liquidity and price range
// Uses Uniswap V3 math: https://docs.uniswap.org/contracts/v3/reference/core/libraries/LiquidityAmounts
function getAmountsFromLiquidity(
  liquidity: bigint,
  sqrtPriceX96: bigint,
  tickLower: number,
  tickUpper: number,
  token0Decimals: number,
  token1Decimals: number
): { amount0: number; amount1: number } {
  const Q96 = 2n ** 96n;
  const sqrtRatioA = tickToSqrtRatioX96(tickLower);
  const sqrtRatioB = tickToSqrtRatioX96(tickUpper);

  // Ensure sqrtRatioA < sqrtRatioB
  const [sqrtLower, sqrtUpper] = sqrtRatioA < sqrtRatioB
    ? [sqrtRatioA, sqrtRatioB]
    : [sqrtRatioB, sqrtRatioA];


  let amount0 = 0n;
  let amount1 = 0n;

  try {
    if (sqrtPriceX96 <= sqrtLower) {
      // Below range - only token0
      // amount0 = L * Q96 * (sqrtUpper - sqrtLower) / (sqrtLower * sqrtUpper)
      if (sqrtLower > 0n && sqrtUpper > 0n) {
        const diff = sqrtUpper - sqrtLower;
        const numerator = liquidity * Q96 * diff;
        const denominator = sqrtLower * sqrtUpper;
        amount0 = numerator / denominator;
      }
    } else if (sqrtPriceX96 >= sqrtUpper) {
      // Above range - only token1
      // amount1 = L * (sqrtUpper - sqrtLower) / Q96
      const diff = sqrtUpper - sqrtLower;
      amount1 = (liquidity * diff) / Q96;
    } else {
      // In range - both tokens
      // amount0 = L * Q96 * (sqrtUpper - sqrtPrice) / (sqrtPrice * sqrtUpper)
      const diff0 = sqrtUpper - sqrtPriceX96;
      const numerator0 = liquidity * Q96 * diff0;
      const denominator0 = sqrtPriceX96 * sqrtUpper;
      if (denominator0 > 0n) {
        amount0 = numerator0 / denominator0;
      }

      // amount1 = L * (sqrtPrice - sqrtLower) / Q96
      const diff1 = sqrtPriceX96 - sqrtLower;
      amount1 = (liquidity * diff1) / Q96;
    }
  } catch (err) {
    console.error('Error calculating amounts:', err);
  }

  return {
    amount0: Number(amount0) / Math.pow(10, token0Decimals),
    amount1: Number(amount1) / Math.pow(10, token1Decimals),
  };
}

export interface OnChainPosition {
  tokenId: bigint;
  nonce: bigint;
  operator: string;
  token0: string;
  token1: string;
  fee: number;
  tickLower: number;
  tickUpper: number;
  liquidity: bigint;
  feeGrowthInside0LastX128: bigint;
  feeGrowthInside1LastX128: bigint;
  tokensOwed0: bigint;
  tokensOwed1: bigint;
  token0Symbol?: string;
  token1Symbol?: string;
  token0Decimals?: number;
  token1Decimals?: number;
  version?: 'v3' | 'v4';
  // Calculated values
  token0Amount?: number;
  token1Amount?: number;
  currentTick?: number;
  inRange?: boolean;
  // Calculated uncollected fees
  uncollectedFees0?: number;
  uncollectedFees1?: number;
  // Chain info for multi-chain support
  chainId?: number;
  chainName?: string;
}

// Constants for fee calculation
const Q128 = 2n ** 128n;

// Calculate uncollected fees for a position
// Based on Uniswap V3 fee calculation logic
function calculateUncollectedFees(
  liquidity: bigint,
  feeGrowthInside0LastX128: bigint,
  feeGrowthInside1LastX128: bigint,
  feeGrowthInside0X128: bigint,
  feeGrowthInside1X128: bigint,
  tokensOwed0: bigint,
  tokensOwed1: bigint,
  token0Decimals: number,
  token1Decimals: number
): { fees0: number; fees1: number } {
  // Calculate the fee growth delta (handle underflow with modular arithmetic)
  const feeGrowthDelta0 = (feeGrowthInside0X128 - feeGrowthInside0LastX128 + (2n ** 256n)) % (2n ** 256n);
  const feeGrowthDelta1 = (feeGrowthInside1X128 - feeGrowthInside1LastX128 + (2n ** 256n)) % (2n ** 256n);

  // Calculate uncollected fees: fees = (liquidity * feeGrowthDelta) / Q128 + tokensOwed
  const uncollectedFees0 = (liquidity * feeGrowthDelta0) / Q128 + tokensOwed0;
  const uncollectedFees1 = (liquidity * feeGrowthDelta1) / Q128 + tokensOwed1;

  return {
    fees0: Number(uncollectedFees0) / Math.pow(10, token0Decimals),
    fees1: Number(uncollectedFees1) / Math.pow(10, token1Decimals),
  };
}

// Calculate feeGrowthInside from global and tick values
function calculateFeeGrowthInside(
  tickLower: number,
  tickUpper: number,
  currentTick: number,
  feeGrowthGlobal0X128: bigint,
  feeGrowthGlobal1X128: bigint,
  tickLowerFeeGrowthOutside0X128: bigint,
  tickLowerFeeGrowthOutside1X128: bigint,
  tickUpperFeeGrowthOutside0X128: bigint,
  tickUpperFeeGrowthOutside1X128: bigint
): { feeGrowthInside0X128: bigint; feeGrowthInside1X128: bigint } {
  let feeGrowthBelow0X128: bigint;
  let feeGrowthBelow1X128: bigint;
  let feeGrowthAbove0X128: bigint;
  let feeGrowthAbove1X128: bigint;

  // Calculate fee growth below
  if (currentTick >= tickLower) {
    feeGrowthBelow0X128 = tickLowerFeeGrowthOutside0X128;
    feeGrowthBelow1X128 = tickLowerFeeGrowthOutside1X128;
  } else {
    feeGrowthBelow0X128 = feeGrowthGlobal0X128 - tickLowerFeeGrowthOutside0X128;
    feeGrowthBelow1X128 = feeGrowthGlobal1X128 - tickLowerFeeGrowthOutside1X128;
  }

  // Calculate fee growth above
  if (currentTick < tickUpper) {
    feeGrowthAbove0X128 = tickUpperFeeGrowthOutside0X128;
    feeGrowthAbove1X128 = tickUpperFeeGrowthOutside1X128;
  } else {
    feeGrowthAbove0X128 = feeGrowthGlobal0X128 - tickUpperFeeGrowthOutside0X128;
    feeGrowthAbove1X128 = feeGrowthGlobal1X128 - tickUpperFeeGrowthOutside1X128;
  }

  // Fee growth inside = global - below - above (with overflow handling)
  const feeGrowthInside0X128 = (feeGrowthGlobal0X128 - feeGrowthBelow0X128 - feeGrowthAbove0X128 + (2n ** 256n)) % (2n ** 256n);
  const feeGrowthInside1X128 = (feeGrowthGlobal1X128 - feeGrowthBelow1X128 - feeGrowthAbove1X128 + (2n ** 256n)) % (2n ** 256n);

  return { feeGrowthInside0X128, feeGrowthInside1X128 };
}

// Helper to fetch positions for a single chain
async function fetchV3PositionsForChain(
  config: any,
  address: `0x${string}`,
  chainId: number,
  chainName: string
): Promise<OnChainPosition[]> {
  const positionManagerAddress = POSITION_MANAGER_ADDRESSES[chainId] as `0x${string}` | undefined;
  const factoryAddress = FACTORY_ADDRESSES[chainId] as `0x${string}` | undefined;

  if (!positionManagerAddress || !factoryAddress) {
    console.log(`No position manager or factory for chain ${chainName}`);
    return [];
  }

  try {
    // Get balance for this chain
    const balanceResult = await readContracts(config, {
      contracts: [{
        address: positionManagerAddress,
        abi: POSITION_MANAGER_ABI,
        functionName: 'balanceOf',
        args: [address],
        chainId,
      }] as any,
    });

    const balance = balanceResult[0]?.result as bigint | undefined;
    const numPositions = balance ? Number(balance) : 0;

    console.log(`${chainName}: Found ${numPositions} V3 positions`);

    if (numPositions === 0) return [];

    // Get all token IDs
    const tokenIdContracts = Array.from({ length: numPositions }, (_, index) => ({
      address: positionManagerAddress,
      abi: POSITION_MANAGER_ABI,
      functionName: 'tokenOfOwnerByIndex',
      args: [address, BigInt(index)],
      chainId,
    }));

    const tokenIdResults = await readContracts(config, {
      contracts: tokenIdContracts as any,
    });

    const tokenIds = tokenIdResults
      .map((result) => result.result as bigint | undefined)
      .filter((id): id is bigint => id !== undefined);

    if (tokenIds.length === 0) return [];

    // Get position data for each token ID
    const positionContracts = tokenIds.map((tokenId) => ({
      address: positionManagerAddress,
      abi: POSITION_MANAGER_ABI,
      functionName: 'positions',
      args: [tokenId],
      chainId,
    }));

    const positionResults = await readContracts(config, {
      contracts: positionContracts as any,
    });

    const positionsWithTokenInfo: OnChainPosition[] = [];

    // Process each position
    for (let i = 0; i < positionResults.length; i++) {
      const result = positionResults[i].result as any;
      const tokenId = tokenIds[i];

      if (!result) continue;

      const [nonce, operator, token0, token1, fee, tickLower, tickUpper, liquidity,
             feeGrowthInside0LastX128, feeGrowthInside1LastX128, tokensOwed0, tokensOwed1] = result;

      // Skip positions with no liquidity
      if (liquidity === BigInt(0)) continue;

      // Fetch token info
      const tokenInfoContracts = [
        { address: token0 as `0x${string}`, abi: ERC20_ABI, functionName: 'symbol', chainId },
        { address: token0 as `0x${string}`, abi: ERC20_ABI, functionName: 'decimals', chainId },
        { address: token1 as `0x${string}`, abi: ERC20_ABI, functionName: 'symbol', chainId },
        { address: token1 as `0x${string}`, abi: ERC20_ABI, functionName: 'decimals', chainId },
      ];

      const tokenInfoResults = await readContracts(config, { contracts: tokenInfoContracts as any });

      const token0Symbol = (tokenInfoResults[0]?.result as string) || 'UNKNOWN';
      const token0Decimals = Number(tokenInfoResults[1]?.result) || 18;
      const token1Symbol = (tokenInfoResults[2]?.result as string) || 'UNKNOWN';
      const token1Decimals = Number(tokenInfoResults[3]?.result) || 18;

      // Compute pool address and fetch slot0 for token amounts
      let token0Amount = 0;
      let token1Amount = 0;
      let currentTick = 0;
      let inRange = false;
      let uncollectedFees0 = 0;
      let uncollectedFees1 = 0;

      try {
        const poolAddress = computeV3PoolAddress(
          factoryAddress,
          token0 as `0x${string}`,
          token1 as `0x${string}`,
          Number(fee)
        );

        console.log(`${chainName}: Pool address for ${token0Symbol}/${token1Symbol}: ${poolAddress}`);

        // Fetch pool slot0, feeGrowthGlobal, and tick data for fee calculation
        const poolDataContracts = [
          { address: poolAddress, abi: POOL_ABI, functionName: 'slot0', chainId },
          { address: poolAddress, abi: POOL_ABI, functionName: 'feeGrowthGlobal0X128', chainId },
          { address: poolAddress, abi: POOL_ABI, functionName: 'feeGrowthGlobal1X128', chainId },
          { address: poolAddress, abi: POOL_ABI, functionName: 'ticks', args: [Number(tickLower)], chainId },
          { address: poolAddress, abi: POOL_ABI, functionName: 'ticks', args: [Number(tickUpper)], chainId },
        ];

        const poolDataResults = await readContracts(config, {
          contracts: poolDataContracts as any,
        });

        const slot0 = poolDataResults[0]?.result as any;
        const feeGrowthGlobal0X128 = poolDataResults[1]?.result as bigint || 0n;
        const feeGrowthGlobal1X128 = poolDataResults[2]?.result as bigint || 0n;
        const tickLowerData = poolDataResults[3]?.result as any;
        const tickUpperData = poolDataResults[4]?.result as any;

        if (slot0) {
          const sqrtPriceX96 = slot0[0] as bigint;
          currentTick = Number(slot0[1]);
          inRange = currentTick >= Number(tickLower) && currentTick < Number(tickUpper);

          console.log(`${chainName}: Pool slot0 - sqrtPriceX96: ${sqrtPriceX96}, tick: ${currentTick}, inRange: ${inRange}`);

          // Calculate token amounts
          const amounts = getAmountsFromLiquidity(
            liquidity as bigint,
            sqrtPriceX96,
            Number(tickLower),
            Number(tickUpper),
            token0Decimals,
            token1Decimals
          );
          token0Amount = amounts.amount0;
          token1Amount = amounts.amount1;

          console.log(`${chainName}: Token amounts - ${token0Symbol}: ${token0Amount}, ${token1Symbol}: ${token1Amount}`);

          // Calculate uncollected fees
          if (tickLowerData && tickUpperData) {
            // Extract feeGrowthOutside values from tick data
            // Tick data: [liquidityGross, liquidityNet, feeGrowthOutside0X128, feeGrowthOutside1X128, ...]
            const tickLowerFeeGrowthOutside0X128 = tickLowerData[2] as bigint || 0n;
            const tickLowerFeeGrowthOutside1X128 = tickLowerData[3] as bigint || 0n;
            const tickUpperFeeGrowthOutside0X128 = tickUpperData[2] as bigint || 0n;
            const tickUpperFeeGrowthOutside1X128 = tickUpperData[3] as bigint || 0n;

            // Calculate feeGrowthInside
            const { feeGrowthInside0X128, feeGrowthInside1X128 } = calculateFeeGrowthInside(
              Number(tickLower),
              Number(tickUpper),
              currentTick,
              feeGrowthGlobal0X128,
              feeGrowthGlobal1X128,
              tickLowerFeeGrowthOutside0X128,
              tickLowerFeeGrowthOutside1X128,
              tickUpperFeeGrowthOutside0X128,
              tickUpperFeeGrowthOutside1X128
            );

            // Calculate uncollected fees
            const fees = calculateUncollectedFees(
              liquidity as bigint,
              feeGrowthInside0LastX128 as bigint,
              feeGrowthInside1LastX128 as bigint,
              feeGrowthInside0X128,
              feeGrowthInside1X128,
              tokensOwed0 as bigint,
              tokensOwed1 as bigint,
              token0Decimals,
              token1Decimals
            );
            uncollectedFees0 = fees.fees0;
            uncollectedFees1 = fees.fees1;

            console.log(`${chainName}: Uncollected fees - ${token0Symbol}: ${uncollectedFees0}, ${token1Symbol}: ${uncollectedFees1}`);
          }
        }
      } catch (err) {
        console.error(`${chainName}: Error fetching pool state:`, err);
      }

      positionsWithTokenInfo.push({
        tokenId,
        nonce: nonce as bigint,
        operator: operator as string,
        token0: token0 as string,
        token1: token1 as string,
        fee: Number(fee),
        tickLower: Number(tickLower),
        tickUpper: Number(tickUpper),
        liquidity: liquidity as bigint,
        feeGrowthInside0LastX128: feeGrowthInside0LastX128 as bigint,
        feeGrowthInside1LastX128: feeGrowthInside1LastX128 as bigint,
        tokensOwed0: tokensOwed0 as bigint,
        tokensOwed1: tokensOwed1 as bigint,
        token0Symbol,
        token1Symbol,
        token0Decimals,
        token1Decimals,
        version: 'v3',
        token0Amount,
        token1Amount,
        currentTick,
        inRange,
        uncollectedFees0,
        uncollectedFees1,
        chainId,
        chainName,
      });
    }

    return positionsWithTokenInfo;
  } catch (err) {
    console.error(`${chainName}: Error fetching V3 positions:`, err);
    return [];
  }
}

export function usePositions() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const config = useConfig();
  const [positions, setPositions] = useState<OnChainPosition[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalPositionCount, setTotalPositionCount] = useState(0);

  const fetchPositions = useCallback(async () => {
    console.log('fetchPositions called - fetching from ALL chains', { address });

    if (!address) {
      console.log('No wallet address, skipping fetch');
      setPositions([]);
      setTotalPositionCount(0);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Fetch V3 positions from ALL chains in parallel
      console.log('Fetching V3 positions from all chains...');
      const chainFetches = SUPPORTED_CHAINS.map(chain =>
        fetchV3PositionsForChain(config, address as `0x${string}`, chain.id, chain.name)
      );

      const allChainPositions = await Promise.all(chainFetches);
      const allV3Positions = allChainPositions.flat();

      console.log(`Total V3 positions across all chains: ${allV3Positions.length}`);
      console.log('V3 positions:', allV3Positions);

      // Fetch V4 positions (currently only Ethereum mainnet has reliable V4 data)
      console.log('Fetching V4 position token IDs from subgraph...');
      const v4TokenIds = await fetchV4PositionTokenIds(address);
      console.log('V4 token IDs:', v4TokenIds);

      const v4PositionsConverted: OnChainPosition[] = [];

      // Try V4 on Ethereum mainnet first (most common)
      const v4ChainId = 1; // Ethereum mainnet
      const v4ChainName = 'Ethereum';
      const v4PositionManagerAddress = V4_POSITION_MANAGER_ADDRESSES[v4ChainId] as `0x${string}` | undefined;

      if (v4PositionManagerAddress && v4TokenIds.length > 0) {
        console.log('Fetching V4 position details from contract...');

        for (const tokenId of v4TokenIds) {
          try {
            console.log(`Fetching V4 position details for token ID: ${tokenId}`);

            // Get pool and position info - use individual readContract calls to bypass
            // multicall3, which reverts when used with the V4 PositionManager
            const [poolAndPositionInfo, liquidity] = await Promise.all([
              readContract(config, {
                address: v4PositionManagerAddress,
                abi: V4_POSITION_MANAGER_ABI,
                functionName: 'getPoolAndPositionInfo',
                args: [tokenId],
                chainId: v4ChainId,
              }).catch(() => undefined),
              readContract(config, {
                address: v4PositionManagerAddress,
                abi: V4_POSITION_MANAGER_ABI,
                functionName: 'getPositionLiquidity',
                args: [tokenId],
                chainId: v4ChainId,
              }).catch(() => undefined as bigint | undefined),
            ]);

            console.log(`Pool info for token ${tokenId}:`, poolAndPositionInfo);
            console.log(`Liquidity for token ${tokenId}:`, liquidity);

            if (!poolAndPositionInfo || !liquidity) {
              console.log(`Skipping token ${tokenId} - no pool info or zero liquidity`);
              continue;
            }

            const [poolKey, positionInfoPacked] = poolAndPositionInfo;

            // Decode the packed PositionInfo uint256
            const { tickLower, tickUpper } = decodePositionInfo(positionInfoPacked);

            const token0 = poolKey.currency0 as string;
            const token1 = poolKey.currency1 as string;
            const fee = Number(poolKey.fee);

            console.log(`Decoded position - tickLower: ${tickLower}, tickUpper: ${tickUpper}`);
            console.log(`Token0: ${token0}, Token1: ${token1}`);

            // Check if token is native ETH (zero address)
            const isToken0Native = token0.toLowerCase() === '0x0000000000000000000000000000000000000000';
            const isToken1Native = token1.toLowerCase() === '0x0000000000000000000000000000000000000000';

            // Fetch token info only for non-native tokens
            let token0Symbol = 'ETH';
            let token0Decimals = 18;
            let token1Symbol = 'ETH';
            let token1Decimals = 18;

            if (!isToken0Native) {
              const token0InfoContracts = [
                { address: token0 as `0x${string}`, abi: ERC20_ABI, functionName: 'symbol', chainId: v4ChainId },
                { address: token0 as `0x${string}`, abi: ERC20_ABI, functionName: 'decimals', chainId: v4ChainId },
              ];
              const token0Info = await readContracts(config, { contracts: token0InfoContracts as any });
              token0Symbol = (token0Info[0]?.result as string) || 'UNKNOWN';
              token0Decimals = Number(token0Info[1]?.result) || 18;
            }

            if (!isToken1Native) {
              const token1InfoContracts = [
                { address: token1 as `0x${string}`, abi: ERC20_ABI, functionName: 'symbol', chainId: v4ChainId },
                { address: token1 as `0x${string}`, abi: ERC20_ABI, functionName: 'decimals', chainId: v4ChainId },
              ];
              const token1Info = await readContracts(config, { contracts: token1InfoContracts as any });
              token1Symbol = (token1Info[0]?.result as string) || 'UNKNOWN';
              token1Decimals = Number(token1Info[1]?.result) || 18;
            }

            console.log(`Token symbols: ${token0Symbol}/${token1Symbol}`);

            // Fetch pool state from StateView to calculate token amounts and fees
            let token0Amount = 0;
            let token1Amount = 0;
            let currentTick = 0;
            let inRange = true;
            let uncollectedFees0 = 0;
            let uncollectedFees1 = 0;

            const stateViewAddress = V4_STATE_VIEW_ADDRESSES[v4ChainId] as `0x${string}` | undefined;
            if (stateViewAddress) {
              try {
                // Compute poolId from poolKey
                const poolId = computePoolId({
                  currency0: token0,
                  currency1: token1,
                  fee: fee,
                  tickSpacing: Number(poolKey.tickSpacing),
                  hooks: poolKey.hooks as string,
                });
                console.log(`Computed poolId: ${poolId}`);

                // Get pool state (slot0)
                const slot0Result = await readContracts(config, {
                  contracts: [{
                    address: stateViewAddress,
                    abi: V4_STATE_VIEW_ABI,
                    functionName: 'getSlot0',
                    args: [poolId],
                    chainId: v4ChainId,
                  }] as any,
                });

                const slot0 = slot0Result[0]?.result as [bigint, number, number, number] | undefined;
                if (slot0) {
                  const [sqrtPriceX96, tick] = slot0;
                  currentTick = tick;
                  inRange = tick >= tickLower && tick < tickUpper;

                  console.log(`Pool state - sqrtPriceX96: ${sqrtPriceX96}, tick: ${tick}, inRange: ${inRange}`);

                  // Calculate token amounts
                  const amounts = getAmountsFromLiquidity(
                    liquidity,
                    sqrtPriceX96,
                    tickLower,
                    tickUpper,
                    token0Decimals,
                    token1Decimals
                  );
                  token0Amount = amounts.amount0;
                  token1Amount = amounts.amount1;

                  console.log(`Token amounts - ${token0Symbol}: ${token0Amount}, ${token1Symbol}: ${token1Amount}`);
                }

                // Calculate V4 uncollected fees using StateView
                // Get position info (liquidity, feeGrowthInside0LastX128, feeGrowthInside1LastX128)
                // and current fee growth inside
                try {
                  // Salt for PositionManager is the tokenId as bytes32
                  const salt = ('0x' + tokenId.toString(16).padStart(64, '0')) as `0x${string}`;

                  const feeDataContracts = [
                    {
                      address: stateViewAddress,
                      abi: V4_STATE_VIEW_ABI,
                      functionName: 'getPositionInfo',
                      args: [poolId, v4PositionManagerAddress, tickLower, tickUpper, salt],
                      chainId: v4ChainId,
                    },
                    {
                      address: stateViewAddress,
                      abi: V4_STATE_VIEW_ABI,
                      functionName: 'getFeeGrowthInside',
                      args: [poolId, tickLower, tickUpper],
                      chainId: v4ChainId,
                    },
                  ];

                  const feeDataResults = await readContracts(config, {
                    contracts: feeDataContracts as any,
                  });

                  const positionInfo = feeDataResults[0]?.result as [bigint, bigint, bigint] | undefined;
                  const feeGrowthInside = feeDataResults[1]?.result as [bigint, bigint] | undefined;

                  if (positionInfo && feeGrowthInside) {
                    const [, feeGrowthInside0LastX128, feeGrowthInside1LastX128] = positionInfo;
                    const [feeGrowthInside0X128, feeGrowthInside1X128] = feeGrowthInside;

                    console.log(`V4 Fee growth - last0: ${feeGrowthInside0LastX128}, current0: ${feeGrowthInside0X128}`);

                    // Calculate uncollected fees
                    const fees = calculateUncollectedFees(
                      liquidity,
                      feeGrowthInside0LastX128,
                      feeGrowthInside1LastX128,
                      feeGrowthInside0X128,
                      feeGrowthInside1X128,
                      0n, // V4 doesn't have tokensOwed
                      0n,
                      token0Decimals,
                      token1Decimals
                    );
                    uncollectedFees0 = fees.fees0;
                    uncollectedFees1 = fees.fees1;

                    console.log(`V4 Uncollected fees - ${token0Symbol}: ${uncollectedFees0}, ${token1Symbol}: ${uncollectedFees1}`);
                  }
                } catch (feeErr) {
                  console.log(`Could not fetch V4 fees for position ${tokenId}:`, feeErr);
                }
              } catch (err) {
                console.error(`Error fetching pool state for position ${tokenId}:`, err);
              }
            }

            v4PositionsConverted.push({
              tokenId,
              nonce: BigInt(0),
              operator: '0x0000000000000000000000000000000000000000',
              token0,
              token1,
              fee,
              tickLower,
              tickUpper,
              liquidity,
              feeGrowthInside0LastX128: BigInt(0),
              feeGrowthInside1LastX128: BigInt(0),
              tokensOwed0: BigInt(0),
              tokensOwed1: BigInt(0),
              token0Symbol,
              token1Symbol,
              token0Decimals,
              token1Decimals,
              version: 'v4',
              token0Amount,
              token1Amount,
              currentTick,
              inRange,
              uncollectedFees0,
              uncollectedFees1,
              chainId: v4ChainId,
              chainName: v4ChainName,
            });
            console.log(`Successfully added V4 position ${tokenId}`);
          } catch (err) {
            console.error(`Error fetching V4 position ${tokenId}:`, err);
            console.error('Full error details:', JSON.stringify(err, null, 2));
          }
        }
      }

      console.log('V4 positions with details:', v4PositionsConverted);

      // Combine V3 and V4 positions
      const allPositions = [...allV3Positions, ...v4PositionsConverted];
      console.log('Final combined positions:', allPositions);
      setPositions(allPositions);
      setTotalPositionCount(allPositions.length);
    } catch (err) {
      console.error('Error fetching positions:', err);
      setError('Failed to fetch positions');
      setPositions([]);
    } finally {
      setIsLoading(false);
    }
  }, [address, config]);

  useEffect(() => {
    if (isConnected) {
      fetchPositions();
    }
  }, [isConnected, fetchPositions]);

  return {
    positions,
    isLoading,
    error,
    refetch: fetchPositions,
    positionCount: totalPositionCount,
  };
}

// Hook for getting token information
export function useTokenInfo(tokenAddress: string | undefined) {
  const { data: symbol } = useReadContract({
    address: tokenAddress as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'symbol',
    query: {
      enabled: !!tokenAddress,
    },
  });

  const { data: decimals } = useReadContract({
    address: tokenAddress as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'decimals',
    query: {
      enabled: !!tokenAddress,
    },
  });

  const { data: name } = useReadContract({
    address: tokenAddress as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'name',
    query: {
      enabled: !!tokenAddress,
    },
  });

  return {
    symbol: symbol as string | undefined,
    decimals: decimals as number | undefined,
    name: name as string | undefined,
  };
}
