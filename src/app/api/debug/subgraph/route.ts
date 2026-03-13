import { NextResponse } from 'next/server';

const GRAPH_API_KEY = process.env.NEXT_PUBLIC_GRAPH_API_KEY || '';
const SUBGRAPH_ID = '5zvR82QoaXYFyDEKLZ9t6v9adgnptxYpKpSbxtgVENFV';

// Simple test query to check if subgraph responds
const TEST_QUERY = `
  query {
    positions(first: 1) {
      id
      collectedFeesToken0
      collectedFeesToken1
    }
  }
`;

export async function GET() {
  const hasKey = !!GRAPH_API_KEY && GRAPH_API_KEY.length > 20;
  const urlWithKey = hasKey
    ? `https://gateway.thegraph.com/api/${GRAPH_API_KEY}/subgraphs/id/${SUBGRAPH_ID}`
    : null;
  const urlFree = `https://gateway.thegraph.com/api/subgraphs/id/${SUBGRAPH_ID}`;

  const results: Record<string, unknown> = {
    apiKeyPresent: hasKey,
    apiKeyLength: GRAPH_API_KEY.length,
    apiKeyPrefix: GRAPH_API_KEY.substring(0, 6) + '...',
    timestamp: new Date().toISOString(),
  };

  // Test with API key if available
  if (urlWithKey) {
    try {
      const res = await fetch(urlWithKey, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: TEST_QUERY }),
      });
      const data = await res.json();
      results.withKey = {
        status: res.status,
        hasData: !!data.data?.positions?.length,
        positions: data.data?.positions || null,
        errors: data.errors || null,
      };
    } catch (e) {
      results.withKey = { error: e instanceof Error ? e.message : String(e) };
    }
  }

  // Test free gateway
  try {
    const res = await fetch(urlFree, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: TEST_QUERY }),
    });
    const data = await res.json();
    results.freeGateway = {
      status: res.status,
      hasData: !!data.data?.positions?.length,
      positions: data.data?.positions || null,
      errors: data.errors || null,
    };
  } catch (e) {
    results.freeGateway = { error: e instanceof Error ? e.message : String(e) };
  }

  return NextResponse.json(results);
}
