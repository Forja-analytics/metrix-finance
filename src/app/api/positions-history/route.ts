import { NextRequest, NextResponse } from 'next/server';

// Server-side subgraph fetching — env vars always available at runtime
const GRAPH_API_KEY = process.env.NEXT_PUBLIC_GRAPH_API_KEY || '';

const UNISWAP_V3_SUBGRAPH_IDS: Record<string, string> = {
  ethereum: '5zvR82QoaXYFyDEKLZ9t6v9adgnptxYpKpSbxtgVENFV',
  arbitrum: 'FbCGRftH4a3yZugY7TnbYgPJVEv2LvMT6oF1fxPe9aJM',
  polygon: '3hCPRGf4z88VC5rsBKU5AA9FBBq5nF3jbKJG7VZCbhjm',
  optimism: 'Cghf4LfVqPiFw6fp6Y5X5Ubc8UpmUhSfJL82zwiBFLaj',
  base: 'GqzP4Xaehti8KSfQmv3ZctFSjnSUYZ4En5NRsiTbvZpz',
  bsc: 'F85MNzUGYqgSHSHRGgeVMNsdnW1KtZSVgFULumXRZTw2',
};

const CHAIN_ID_TO_NETWORK: Record<number, string> = {
  1: 'ethereum',
  42161: 'arbitrum',
  137: 'polygon',
  10: 'optimism',
  8453: 'base',
  56: 'bsc',
};

const POSITIONS_BY_IDS_QUERY = `
  query GetPositionsByIds($tokenIds: [String!]!) {
    positions(where: { id_in: $tokenIds }) {
      id
      owner
      pool {
        id
        token0 { symbol decimals }
        token1 { symbol decimals }
      }
      liquidity
      depositedToken0
      depositedToken1
      collectedFeesToken0
      collectedFeesToken1
      transaction {
        timestamp
        blockNumber
      }
    }
  }
`;

const MINTS_BY_POSITION_QUERY = `
  query GetMintsByPosition($tokenIds: [String!]!) {
    mints(where: { position_in: $tokenIds }, orderBy: timestamp, orderDirection: asc) {
      id
      position { id }
      amount0
      amount1
      amountUSD
      timestamp
    }
  }
`;

function getSubgraphUrl(chainId: number): string | null {
  const network = CHAIN_ID_TO_NETWORK[chainId];
  if (!network) return null;
  const subgraphId = UNISWAP_V3_SUBGRAPH_IDS[network];
  if (!subgraphId) return null;
  if (GRAPH_API_KEY && GRAPH_API_KEY.length > 20) {
    return `https://gateway.thegraph.com/api/${GRAPH_API_KEY}/subgraphs/id/${subgraphId}`;
  }
  return null;
}

// GET /api/positions-history?tokenIds=1,2,3&chainId=1
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tokenIdsParam = searchParams.get('tokenIds');
  const chainId = parseInt(searchParams.get('chainId') || '1');

  if (!tokenIdsParam) {
    return NextResponse.json({ error: 'tokenIds parameter required' }, { status: 400 });
  }

  const tokenIds = tokenIdsParam.split(',').filter(Boolean);
  const subgraphUrl = getSubgraphUrl(chainId);

  if (!subgraphUrl) {
    return NextResponse.json({
      positions: {},
      success: false,
      error: 'No subgraph URL available — missing GRAPH_API_KEY',
    });
  }

  try {
    const [positionsResponse, mintsResponse] = await Promise.all([
      fetch(subgraphUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: POSITIONS_BY_IDS_QUERY,
          variables: { tokenIds },
        }),
      }),
      fetch(subgraphUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: MINTS_BY_POSITION_QUERY,
          variables: { tokenIds },
        }),
      }),
    ]);

    const positionsData = await positionsResponse.json();
    const mintsData = await mintsResponse.json();

    if (positionsData.errors) {
      return NextResponse.json({
        positions: {},
        success: false,
        error: `Subgraph error: ${positionsData.errors[0]?.message}`,
      });
    }

    const positions = positionsData.data?.positions || [];
    const mints = mintsData.data?.mints || [];

    // Calculate deposited USD per position from mint events
    const depositedUSDByPosition = new Map<string, number>();
    for (const mint of mints) {
      const positionId = mint.position?.id;
      if (positionId) {
        const currentTotal = depositedUSDByPosition.get(positionId) || 0;
        depositedUSDByPosition.set(positionId, currentTotal + (parseFloat(mint.amountUSD) || 0));
      }
    }

    // Build results map
    const results: Record<string, {
      tokenId: string;
      createdTimestamp: number;
      createdBlockNumber: number;
      depositedToken0: number;
      depositedToken1: number;
      depositedUSD: number;
      claimedFees0: number;
      claimedFees1: number;
      totalCollects: number;
    }> = {};

    for (const position of positions) {
      results[position.id] = {
        tokenId: position.id,
        createdTimestamp: parseInt(position.transaction.timestamp) * 1000,
        createdBlockNumber: parseInt(position.transaction.blockNumber),
        depositedToken0: parseFloat(position.depositedToken0) || 0,
        depositedToken1: parseFloat(position.depositedToken1) || 0,
        depositedUSD: depositedUSDByPosition.get(position.id) || 0,
        claimedFees0: parseFloat(position.collectedFeesToken0) || 0,
        claimedFees1: parseFloat(position.collectedFeesToken1) || 0,
        totalCollects: 0,
      };
    }

    return NextResponse.json({
      positions: results,
      success: true,
      count: Object.keys(results).length,
    });
  } catch (error) {
    return NextResponse.json({
      positions: {},
      success: false,
      error: `Fetch error: ${error instanceof Error ? error.message : 'unknown'}`,
    });
  }
}
