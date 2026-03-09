import { NextRequest, NextResponse } from 'next/server';

const V4_POSITION_MANAGER_ETH = '0xbd216513d74c8cf14cf4747e6aaa6420ff64ee9e';
const V4_SUBGRAPH_ID = 'DiYPVdygkfjDWhbxGSqAQxwBKmfKnkWQojqeM2rkLb3G';

async function fetchWithTimeout(url: string, timeoutMs = 15000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(id);
    return res;
  } catch (e) {
    clearTimeout(id);
    throw e;
  }
}

async function fromAlchemy(owner: string, key: string): Promise<string[]> {
  const url = `https://eth-mainnet.g.alchemy.com/nft/v3/${key}/getNFTsForOwner?owner=${owner}&contractAddresses[]=${V4_POSITION_MANAGER_ETH}&withMetadata=false`;
  const res = await fetchWithTimeout(url);
  if (!res.ok) return [];
  const data = await res.json();
  if (!data.ownedNfts?.length) return [];
  return data.ownedNfts.map((nft: { tokenId: string }) => nft.tokenId);
}

async function fromEtherscan(owner: string): Promise<string[]> {
  const apiKey = process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY || '';
  const url = `https://api.etherscan.io/v2/api?chainid=1&module=account&action=tokennfttx&contractaddress=${V4_POSITION_MANAGER_ETH}&address=${owner}&sort=desc${apiKey ? `&apikey=${apiKey}` : ''}`;
  const res = await fetchWithTimeout(url);
  if (!res.ok) return [];
  const data = await res.json();
  if (data.status !== '1' || !data.result) return [];

  const ownership = new Map<string, boolean>();
  for (const tx of data.result) {
    const userAddr = owner.toLowerCase();
    if (tx.to.toLowerCase() === userAddr) ownership.set(tx.tokenID, true);
    else if (tx.from.toLowerCase() === userAddr) ownership.set(tx.tokenID, false);
  }
  return [...ownership.entries()].filter(([, owned]) => owned).map(([id]) => id);
}

async function fromSubgraph(owner: string, key: string): Promise<string[]> {
  const url = `https://gateway.thegraph.com/api/${key}/subgraphs/id/${V4_SUBGRAPH_ID}`;
  const query = `{ positions(where:{owner:"${owner.toLowerCase()}"}, first:100) { tokenId } }`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) return [];
  const data = await res.json();
  return (data?.data?.positions ?? []).map((p: { tokenId: string }) => p.tokenId);
}

export async function GET(request: NextRequest) {
  const address = request.nextUrl.searchParams.get('address');
  if (!address) {
    return NextResponse.json({ error: 'Missing address' }, { status: 400 });
  }

  const graphKey = process.env.NEXT_PUBLIC_GRAPH_API_KEY;
  const alchemyKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;

  // Method 1: The Graph subgraph
  if (graphKey) {
    try {
      const ids = await fromSubgraph(address, graphKey);
      if (ids.length > 0) {
        return NextResponse.json({ tokenIds: ids, source: 'subgraph' });
      }
    } catch { /* fall through */ }
  }

  // Method 2: Alchemy NFT API
  if (alchemyKey) {
    try {
      const ids = await fromAlchemy(address, alchemyKey);
      if (ids.length > 0) {
        return NextResponse.json({ tokenIds: ids, source: 'alchemy' });
      }
    } catch { /* fall through */ }
  }

  // Method 3: Etherscan fallback
  try {
    const ids = await fromEtherscan(address);
    if (ids.length > 0) {
      return NextResponse.json({ tokenIds: ids, source: 'etherscan' });
    }
  } catch { /* fall through */ }

  return NextResponse.json({ tokenIds: [], source: 'none' });
}
