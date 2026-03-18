import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const ids = searchParams.get('ids');
  const vsCurrencies = searchParams.get('vs_currencies') || 'usd';
  const include24hrChange = searchParams.get('include_24hr_change') || 'true';

  // Contract-based price lookup (for tokens not in hardcoded list)
  const platform = searchParams.get('platform');
  const contractAddresses = searchParams.get('contract_addresses');

  try {
    let url: string;

    if (platform && contractAddresses) {
      // Use token_price endpoint for contract-address-based lookups
      url = `https://api.coingecko.com/api/v3/simple/token_price/${platform}?contract_addresses=${contractAddresses}&vs_currencies=${vsCurrencies}`;
    } else if (ids) {
      // Use standard price endpoint for CoinGecko ID-based lookups
      url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=${vsCurrencies}&include_24hr_change=${include24hrChange}`;
    } else {
      return NextResponse.json({ error: 'Missing ids or platform+contract_addresses parameters' }, { status: 400 });
    }

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.status}`);
    }

    const data = await response.json();

    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
      },
    });
  } catch (error) {
    console.error('CoinGecko proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch from CoinGecko' },
      { status: 500 }
    );
  }
}
