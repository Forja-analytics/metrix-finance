# Metrix Finance - Project Reference

## Overview

**Project Name:** Metrix Finance
**Type:** DeFi Liquidity Pool Simulator & Position Tracker
**Purpose:** Discover, simulate, and track concentrated liquidity positions in Uniswap V3/V4 protocols across multiple blockchains.

---

## Technology Stack

| Category | Technology | Version |
|----------|------------|---------|
| Framework | Next.js (App Router) | 16.1.1 |
| UI Library | React | 19.2.0 |
| Language | TypeScript | 5.x |
| Styling | Tailwind CSS | 4.x |
| State Management | Zustand | 5.0.9 |
| Web3 Hooks | wagmi | 2.19.5 |
| Ethereum Library | viem | 2.41.2 |
| Wallet UI | RainbowKit | 2.2.10 |
| Data Fetching | React Query | 5.90.12 |
| GraphQL | graphql-request | 7.3.5 |
| HTTP Client | Axios | 1.13.2 |
| Icons | Lucide React | 0.556.0 |

---

## Project Structure

```
metrix-finance/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── layout.tsx                # Root layout (Web3Provider, Navbar, AuthModal)
│   │   ├── page.tsx                  # Home - Pool Discovery
│   │   ├── simulate/page.tsx         # Pool Simulation
│   │   ├── track/page.tsx            # Position Tracking
│   │   └── pricing/page.tsx          # Pricing Plans
│   │
│   ├── components/
│   │   ├── dashboard/
│   │   │   ├── MarketMetrics.tsx     # Market data widgets (Fear & Greed, TVL, etc.)
│   │   │   ├── PairSelector.tsx      # Token pair selection
│   │   │   └── PoolTable.tsx         # Sortable pool list with pagination
│   │   ├── simulate/
│   │   │   ├── SimulationForm.tsx    # Simulation input form
│   │   │   └── SimulationResults.tsx # Results display
│   │   ├── track/
│   │   │   ├── PositionCard.tsx      # Manual position display
│   │   │   ├── WalletPositionCard.tsx # Connected wallet positions
│   │   │   ├── AddPositionModal.tsx  # Add position modal
│   │   │   └── V4PositionLookup.tsx  # V4 position lookup
│   │   ├── layout/
│   │   │   ├── Navbar.tsx            # Top navigation
│   │   │   ├── Sidebar.tsx           # Side navigation
│   │   │   └── AuthModal.tsx         # Authentication modal
│   │   ├── providers/
│   │   │   └── Web3Provider.tsx      # wagmi + RainbowKit + React Query wrapper
│   │   └── ui/
│   │       ├── Button.tsx            # Reusable button
│   │       ├── Card.tsx              # Card component
│   │       ├── Input.tsx             # Input component
│   │       └── Select.tsx            # Select dropdown
│   │
│   ├── lib/
│   │   ├── api.ts                    # External API calls (CoinGecko, DeFi Llama, Fear & Greed)
│   │   ├── uniswap-subgraph.ts       # Uniswap V3 GraphQL queries (The Graph)
│   │   ├── v4-subgraph.ts            # Uniswap V4 GraphQL queries
│   │   ├── store.ts                  # Zustand store (persisted to localStorage)
│   │   ├── wagmi.ts                  # wagmi config, contract addresses
│   │   ├── contracts.ts              # Smart contract ABIs (V3/V4)
│   │   ├── utils.ts                  # Utility functions (formatting, calculations)
│   │   └── constants.ts              # Constants (networks, exchanges, fee tiers, tokens)
│   │
│   ├── hooks/
│   │   └── usePositions.ts           # Multi-chain position fetching hook
│   │
│   └── types/
│       └── index.ts                  # TypeScript interfaces
│
├── public/                           # Static assets
├── package.json
├── tsconfig.json
├── next.config.ts
├── postcss.config.mjs
└── eslint.config.mjs
```

---

## Supported Networks

| Network | Chain ID | V3 Support | V4 Support |
|---------|----------|------------|------------|
| Ethereum | 1 | Yes | Yes |
| Arbitrum | 42161 | Yes | No |
| Polygon | 137 | Yes | No |
| Optimism | 10 | Yes | No |
| Base | 8453 | Yes | No |
| BSC | 56 | Yes | No |

---

## Key Features

### 1. Pool Discovery (Home Page)
- Browse liquidity pools across 6 networks
- Filter by exchange (Uniswap V3/V4), network, fee tier
- Search by token or pool address
- Sort by TVL, 24h volume, 24h fees, APR
- Protocol statistics display
- Pagination (50 pools per page)

### 2. Pool Simulator
- Select pool and input deposit amount
- Set custom price range (tickLower, tickUpper)
- Specify simulation duration
- Outputs: estimated fees, APR, impermanent loss, time in-range

### 3. Position Tracker
- Wallet connection via RainbowKit
- Auto-fetch V3 positions from all supported chains
- Auto-fetch V4 positions from Ethereum
- Display: token amounts, uncollected fees, P&L, in-range status
- Historical data from The Graph (deposits, fee collections)
- Manual position tracking

### 4. Market Intelligence
- Fear & Greed Index (Alternative.me API)
- DeFi market cap and 24h changes
- Crypto market cap
- Altcoin season index
- 24h DeFi volume

---

## External APIs & Services

| Service | Endpoint | Purpose |
|---------|----------|---------|
| The Graph | gateway.thegraph.com | Uniswap V3/V4 subgraph queries |
| CoinGecko | api.coingecko.com | Token prices |
| DeFi Llama | api.llama.fi | TVL data |
| Alternative.me | api.alternative.me | Fear & Greed Index |

---

## Smart Contracts (Read-Only)

### Uniswap V3
- **NonfungiblePositionManager** - LP positions as NFTs
- **Pool** - Core pool contract (computed via CREATE2)
- **Factory** - Pool creation and address computation
- **ERC20** - Token metadata

### Uniswap V4
- **PoolManager** - Core V4 pool logic
- **PositionManager** - V4 position management
- **StateView** - Read-only state queries

---

## State Management (Zustand)

**Storage Key:** `"metrix-storage"` (localStorage)

**Persisted State:**
- `selectedExchange` - Current exchange filter
- `selectedNetwork` - Current network filter
- `selectedPool` - Currently selected pool
- `recentlyViewedPools` - Last viewed pools (max 10)
- `simulationParams` - Simulation form state
- `trackedPositions` - Manually tracked positions
- `isPro` - Pro subscription status

---

## Key Utility Functions (src/lib/utils.ts)

| Function | Purpose |
|----------|---------|
| `formatCurrency(value)` | Format to USD with compact notation (T/B/M/K) |
| `formatNumber(value, decimals)` | Number formatting |
| `formatPercent(value)` | Percentage with sign |
| `shortenAddress(address)` | Truncate Ethereum address |
| `calculateAPR(fees, tvl, days)` | APR calculation |
| `tickToPrice(tick)` | Uniswap tick to price |
| `priceToTick(price)` | Price to Uniswap tick |
| `calculateImpermanentLoss(priceChange)` | IL calculation |
| `cn(...classes)` | Tailwind class merging |

---

## Environment Variables

```env
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=   # WalletConnect project ID
NEXT_PUBLIC_GRAPH_API_KEY=              # The Graph API key (optional)
```

---

## Key Implementation Details

### Position Fetching (usePositions.ts)
1. Fetches V3 positions using `balanceOf` + `tokenOfOwnerByIndex` pattern
2. Reads position data from NonfungiblePositionManager
3. Computes pool address using CREATE2 (factory + init code hash)
4. Reads pool state (slot0, ticks) for fee calculations
5. Calculates token amounts from liquidity using sqrtPrice
6. Computes uncollected fees with Q128 precision math

### Subgraph Queries
- V3: Pools, positions, ModifyLiquidity events
- V4: PositionManager tokenIds, position history
- Fallback to mock data when subgraph unavailable

### Tick Mathematics
- sqrtPriceX96 conversions
- Tick spacing by fee tier (1/10/60/200)
- In-range detection (tickLower <= currentTick < tickUpper)

---

## Monetization Model

| Plan | Price | Limits |
|------|-------|--------|
| Free | $0 | 5 simulations/day, 1 position |
| Pro | $19/month | Unlimited simulations, 25 positions |
| Enterprise | $99/month | API access, unlimited positions, team features |

---

## Development Commands

```bash
npm run dev      # Start development server
npm run build    # Production build
npm run start    # Start production server
npm run lint     # Run ESLint
```

---

## Important Notes

1. **Read-only blockchain interaction** - No transaction execution, only state reading
2. **Multi-chain parallel fetching** - Positions fetched from all chains simultaneously
3. **1-minute price cache** - Token prices cached to reduce API calls
4. **React Query caching** - Server state managed with smart caching
5. **localStorage persistence** - Zustand store persists user preferences
6. **Fallback strategies** - Mock data used when external services unavailable

---

## File Naming Conventions

- Components: PascalCase (e.g., `PositionCard.tsx`)
- Utilities/libs: camelCase (e.g., `uniswap-subgraph.ts`)
- Types: PascalCase interfaces (e.g., `Pool`, `Position`)
- Constants: UPPER_SNAKE_CASE (e.g., `SUPPORTED_CHAINS`)

---

## Common Patterns

### API Calls with Caching
```typescript
const priceCache = new Map<string, { price: number; timestamp: number }>();
const CACHE_DURATION = 60000; // 1 minute
```

### Contract Address Maps
```typescript
export const POSITION_MANAGER_ADDRESSES: Record<number, `0x${string}`> = {
  1: '0xC36442b4a4522E871399CD717aBDD847Ab11FE88',
  // ...
};
```

### Zustand Store with Persistence
```typescript
export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({ /* state and actions */ }),
    { name: 'metrix-storage' }
  )
);
```

---

## AI Agent Development Guidelines

### General Rules for All Agents
1. **Read before modifying** - Always read existing code before suggesting changes
2. **Preserve patterns** - Follow existing code patterns in the codebase
3. **No over-engineering** - Keep solutions minimal and focused
4. **Type safety** - All code must be TypeScript with proper types
5. **No secrets** - Never hardcode API keys, private keys, or sensitive data

### Code Style Requirements
```typescript
// DO: Use explicit types
const fetchPools = async (chainId: number): Promise<Pool[]> => { ... }

// DON'T: Use any or implicit types
const fetchPools = async (chainId) => { ... }

// DO: Use wagmi hooks for Web3
const { data } = useReadContract({ ... })

// DON'T: Use raw viem/ethers calls in components
const result = await publicClient.readContract({ ... })

// DO: Handle loading/error states
if (isLoading) return <Skeleton />
if (error) return <ErrorMessage error={error} />

// DON'T: Ignore async states
return <div>{data.map(...)}</div>
```

### DeFi Math Reference
```typescript
// Tick to Price (Uniswap V3/V4)
price = 1.0001^tick * 10^(token0Decimals - token1Decimals)

// sqrtPriceX96 to Price
price = (sqrtPriceX96 / 2^96)^2

// Impermanent Loss
IL = 2 * sqrt(priceRatio) / (1 + priceRatio) - 1

// APR from Fees
APR = (fees24h * 365 / tvl) * 100

// Tick Spacing by Fee Tier
0.01% (100) → 1 tick
0.05% (500) → 10 ticks
0.30% (3000) → 60 ticks
1.00% (10000) → 200 ticks
```

### Contract Interaction Patterns
```typescript
// Multi-chain parallel reads (CORRECT)
const results = await Promise.all(
  SUPPORTED_CHAIN_IDS.map(chainId =>
    readContract(config, { chainId, ...contractCall })
  )
);

// Single chain read (CORRECT)
const { data } = useReadContract({
  address: POSITION_MANAGER_ADDRESSES[chainId],
  abi: POSITION_MANAGER_ABI,
  functionName: 'positions',
  args: [tokenId],
  chainId,
});

// NEVER do write transactions - this is READ-ONLY app
```

### Error Handling Patterns
```typescript
// Subgraph fallback
try {
  const data = await fetchFromSubgraph(query);
  return data;
} catch (error) {
  console.warn('Subgraph unavailable, using fallback');
  return MOCK_DATA;
}

// Price fetch with cache
const getCachedPrice = (tokenId: string): number | null => {
  const cached = priceCache.get(tokenId);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.price;
  }
  return null;
};
```

### File Modification Guidelines
| Task | Correct File |
|------|--------------|
| Add new network | `src/lib/constants.ts` + `src/lib/wagmi.ts` |
| Add new exchange | `src/lib/constants.ts` |
| New contract ABI | `src/lib/contracts.ts` |
| New GraphQL query | `src/lib/uniswap-subgraph.ts` or `src/lib/v4-subgraph.ts` |
| New API integration | `src/lib/api.ts` |
| New utility function | `src/lib/utils.ts` |
| New React hook | `src/hooks/` |
| New component | `src/components/<category>/` |
| New page | `src/app/<route>/page.tsx` |

### Security Checklist
- [ ] No private keys or mnemonics in code
- [ ] API keys only via environment variables
- [ ] Input validation on user-provided addresses
- [ ] Sanitize data from external APIs
- [ ] No transaction signing (read-only app)
- [ ] Rate limiting awareness for external APIs

---

## Agent-Specific Context

### For Smart Contract Agents
- All ABIs are in `src/lib/contracts.ts`
- Contract addresses per chain in `src/lib/wagmi.ts`
- Position Manager pattern: `balanceOf` → `tokenOfOwnerByIndex` → `positions`
- Pool address computed via CREATE2 (not stored)

### For Web3/Frontend Agents
- wagmi config in `src/lib/wagmi.ts`
- Web3Provider wraps entire app in `src/components/providers/Web3Provider.tsx`
- Use `useChainId()` for current chain, not hardcoded values
- RainbowKit handles wallet connection UI

### For GraphQL/Data Agents
- V3 subgraph queries: `src/lib/uniswap-subgraph.ts`
- V4 subgraph queries: `src/lib/v4-subgraph.ts`
- Always include fallback data for when subgraphs fail
- Paginate large queries (limit 1000 per request)

### For Testing Agents
- Mock wallet connections with wagmi test utilities
- Mock subgraph responses for deterministic tests
- Test tick math edge cases (min/max ticks, overflow)
- Test multi-chain fetching with mixed success/failure
