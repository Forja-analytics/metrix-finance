# Bug Report: Track Page Earnings & Pool Filtering

**Date:** 2026-03-13
**Status:** INVESTIGATED & FIXED
**Severity:** High (Earnings data silently incomplete)

---

## 1. Summary

The team reported two issues:
1. Three ease.org pools need to be filtered from the app
2. The Earnings box in Track shows only "current earnings", not "historical earnings"

**Verdict:** The earnings bug is **REAL but conditional** — it manifests when The Graph subgraph is unavailable. The pool filtering issue is **NOT APPLICABLE** to this codebase (ease.org pools are from a different protocol).

---

## 2. Bug #1: Earnings Box Shows Only Current Data

### Root Cause

The earnings calculation in `src/app/track/page.tsx` (lines 279-286) computes:

```
totalEarnings = unclaimedFees + claimedFees
```

Where:
- **unclaimedFees** = on-chain contract state (always available)
- **claimedFees** = historical data from The Graph subgraph (requires API key)

**The problem:** When the subgraph is unavailable (missing `NEXT_PUBLIC_GRAPH_API_KEY`, rate limited, or down), `claimedFees` silently defaults to `$0.00`. The UI shows this as if it's the real value — no error, no warning.

### Impact

| Metric | Expected | When Bug Manifests |
|--------|----------|-------------------|
| Unclaimed | Correct | Correct |
| Claimed | Historical total from subgraph | **$0.00** |
| Total Earnings | Unclaimed + Claimed | **Only unclaimed (understated)** |
| Retention | Meaningful % | **Always 100% (meaningless)** |
| P&L | Complete | **Missing claimed fees component** |

### Files Involved

| File | What Was Wrong |
|------|---------------|
| `src/lib/uniswap-subgraph.ts` → `fetchPositionsHistory()` | Returned empty Map on failure with no status indicator |
| `src/lib/v4-subgraph.ts` → `fetchV4PositionsHistory()` | Same — silent failure |
| `src/lib/v4-subgraph.ts` → `calculateDepositsAndClaims()` | Conflated liquidity withdrawals with fee claims |
| `src/app/track/page.tsx` → Earnings card | No UI indication when data is partial |

### Fixes Applied

**Fix 1: Subgraph functions now return fetch status** (`uniswap-subgraph.ts`, `v4-subgraph.ts`)

Both `fetchPositionsHistory()` and `fetchV4PositionsHistory()` now return:
```typescript
{ data: Map<string, History>, success: boolean, error?: string }
```

Instead of just `Map<string, History>`. This lets the UI know when historical data failed to load.

**Fix 2: Earnings card shows warning when data is incomplete** (`track/page.tsx`)

- Added `historyFetchStatus` state to track subgraph fetch results
- Added `historyDataMissing` derived boolean
- Earnings card now shows:
  - Yellow border instead of primary when data is missing
  - "Partial data" warning badge with AlertTriangle icon
  - Explanatory text: "Claimed fees may be missing — subgraph unavailable"
  - Warning indicator on the Claimed value when it's $0.00 due to missing data

**Fix 3: V4 claimed fees calculation improved** (`v4-subgraph.ts`)

The `calculateDepositsAndClaims()` function previously treated ALL negative ModifyLiquidity amounts as "claimed fees". This is wrong because liquidity withdrawals also produce negative amounts.

New logic:
- `liquidityDelta === 0` with token movement = pure fee collection
- `liquidityDelta > 0` = deposit
- `liquidityDelta < 0` = withdrawal — separates principal return from fee portion by tracking cumulative deposits vs withdrawals

---

## 3. Bug #2: Pool Filtering (ease.org pools)

### Finding: NOT APPLICABLE

The three pools reported:
- `ease.org/ez-cvxsteCRV`
- `ease.org/ez-yvCurve-IronBank`
- `ease.org/ez-SLP-WBTC-WETH`

These are from the **Ease/Cover Protocol** (DeFi insurance), NOT Uniswap. This application exclusively queries Uniswap V3/V4 subgraphs — these pools cannot appear in the current app.

### Preventive Fix Applied

Added a pool blocklist in `src/lib/constants.ts` (`EXCLUDED_POOL_IDENTIFIERS`) and filtering in `src/lib/uniswap-subgraph.ts` → `fetchUniswapPools()`. This ensures these pools are excluded if they ever appear through a future multi-protocol integration.

---

## 4. Files Modified

| File | Change |
|------|--------|
| `src/lib/constants.ts` | Added `EXCLUDED_POOL_IDENTIFIERS` blocklist |
| `src/lib/uniswap-subgraph.ts` | Added `PositionsHistoryResult` type, updated `fetchPositionsHistory()` to return status, added pool filtering |
| `src/lib/v4-subgraph.ts` | Added `V4PositionsHistoryResult` type, updated `fetchV4PositionsHistory()` to return status, fixed `calculateDepositsAndClaims()` |
| `src/app/track/page.tsx` | Added `historyFetchStatus` state, `historyDataMissing` check, updated Earnings card with warning UI |

---

## 5. Correct Approach for Historical Earnings

The correct approach (which this app already implements architecturally) is:

```
Total Earnings = Unclaimed Fees (on-chain) + Claimed Fees (historical)
```

- **Unclaimed**: Read from pool contract via fee growth math (Q128 precision)
- **Claimed (V3)**: Query `collectedFeesToken0/1` from Uniswap V3 subgraph — these are cumulative totals
- **Claimed (V4)**: Analyze `ModifyLiquidity` events, distinguishing fee collections from liquidity removals
- **Retention**: `(Unclaimed / Total) * 100` — only meaningful when both data sources are available

The fix ensures users are **warned** when the historical component is missing, rather than seeing silently incorrect data.

---

## 6. Verification Steps

1. **With valid API key**: Connect wallet → Earnings should show both unclaimed and claimed values, no warning
2. **Without API key**: Remove `NEXT_PUBLIC_GRAPH_API_KEY` → Earnings card should show yellow warning: "Partial data" + "Claimed fees may be missing"
3. **Pool filtering**: Add an ease.org pool ID to a mock response → verify it's filtered out
4. **V4 claims**: Compare claimed fees with Etherscan Collect events for a known V4 position
