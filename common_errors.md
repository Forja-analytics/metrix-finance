# Common Errors & Solutions - Metrix Finance Docker Setup

This document contains solutions to common issues encountered when running Metrix Finance locally with Docker.

## Table of Contents
1. [Build Errors](#build-errors)
2. [Runtime Errors](#runtime-errors)
3. [API & CORS Issues](#api--cors-issues)
4. [Database Issues](#database-issues)
5. [Port Conflicts](#port-conflicts)

---

## Build Errors

### 1. Stripe API Version Error

**Error:**
```
Type '"2024-12-18.acacia"' is not assignable to type '"2025-02-24.acacia"'
```

**Cause:** Outdated Stripe API version in the code doesn't match the installed Stripe SDK version.

**Solution:**
Update all Stripe API version references in:
- `src/app/api/stripe/create-checkout/route.ts`
- `src/app/api/stripe/create-portal/route.ts`
- `src/app/api/stripe/webhook/route.ts`

Change from:
```typescript
apiVersion: '2024-12-18.acacia'
```

To:
```typescript
apiVersion: '2025-02-24.acacia'
```

---

### 2. TypeScript Formatter Type Error

**Error:**
```
Type '(value: number) => [string, "Cumulative Fees"]' is not assignable to type 'Formatter<number, "Cumulative Fees">'
Types of parameters 'value' and 'value' are incompatible.
Type 'number | undefined' is not assignable to type 'number'.
```

**Cause:** Recharts Tooltip formatter expects the value parameter to potentially be `undefined`.

**Solution:**
Update `src/components/simulate/SimulationResults.tsx`:

Change:
```typescript
formatter={(value: number) => [formatCurrency(value), 'Cumulative Fees']}
```

To:
```typescript
formatter={(value: number | undefined) => [formatCurrency(value ?? 0), 'Cumulative Fees']}
```

---

### 3. Next.js Suspense Boundary Error

**Error:**
```
useSearchParams() should be wrapped in a suspense boundary at page "/pricing"
```

**Cause:** Next.js 13+ requires components using `useSearchParams()` to be wrapped in a Suspense boundary.

**Solution:**
Update `src/app/pricing/page.tsx`:

1. Import Suspense:
```typescript
import { Suspense } from 'react';
```

2. Split the component:
```typescript
function PricingPageContent() {
  const searchParams = useSearchParams();
  // ... rest of component
}

export default function PricingPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <PricingPageContent />
    </Suspense>
  );
}
```

---

## Runtime Errors

### 4. Prisma Version Conflict

**Error:**
```
Error code: P1012
error: The datasource property `url` is no longer supported in schema files
```

**Cause:** Docker container trying to run `npx prisma migrate deploy` which installs Prisma v7 instead of the project's v6.

**Solution:**
1. Remove Prisma migration command from `docker-compose.yml`:

Change:
```yaml
command: sh -c "npx prisma migrate deploy && node server.js"
```

To:
```yaml
command: node server.js
```

2. Initialize database tables manually:
```bash
docker-compose exec -T postgres psql -U metrix -d metrix_finance < init-db.sql
```

---

## API & CORS Issues

### 5. CoinGecko CORS Error

**Error:**
```
Access to fetch at 'https://api.coingecko.com/api/v3/simple/price...' has been blocked by CORS policy
```

**Cause:** Client-side API calls to CoinGecko are blocked by CORS when running on localhost.

**Solution:**

1. **Create API proxy route** at `src/app/api/proxy/coingecko/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const ids = searchParams.get('ids');
  const vsCurrencies = searchParams.get('vs_currencies') || 'usd';
  const include24hrChange = searchParams.get('include_24hr_change') || 'true';

  if (!ids) {
    return NextResponse.json({ error: 'Missing ids parameter' }, { status: 400 });
  }

  try {
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=${vsCurrencies}&include_24hr_change=${include24hrChange}`;
    const response = await fetch(url, { headers: { 'Accept': 'application/json' } });

    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
    });
  } catch (error) {
    console.error('CoinGecko proxy error:', error);
    return NextResponse.json({ error: 'Failed to fetch from CoinGecko' }, { status: 500 });
  }
}
```

2. **Update API call** in `src/lib/api.ts`:
```typescript
// Use proxy API route to avoid CORS issues
const apiUrl = typeof window !== 'undefined'
  ? `/api/proxy/coingecko?ids=${ids}&vs_currencies=usd&include_24hr_change=true`
  : `${COINGECKO_API}/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`;

const response = await fetchWithTimeout(apiUrl, 10000);
```

---

### 6. RPC Endpoint CORS Errors (eth.merkle.io)

**Error:**
```
Access to fetch at 'https://eth.merkle.io/' has been blocked by CORS policy
```

**Cause:** Default wagmi RPC endpoints don't work properly on localhost.

**Solution:**
Update `src/lib/wagmi.ts` to use Alchemy RPC:

```typescript
import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { mainnet, arbitrum, polygon, optimism, base, bsc } from 'wagmi/chains';
import { http } from 'wagmi';

const alchemyKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY || 'demo';

export const config = getDefaultConfig({
  appName: 'Metrix Finance',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'demo-project-id',
  chains: [mainnet, arbitrum, polygon, optimism, base, bsc],
  transports: {
    [mainnet.id]: http(`https://eth-mainnet.g.alchemy.com/v2/${alchemyKey}`),
    [arbitrum.id]: http(`https://arb-mainnet.g.alchemy.com/v2/${alchemyKey}`),
    [polygon.id]: http(`https://polygon-mainnet.g.alchemy.com/v2/${alchemyKey}`),
    [optimism.id]: http(`https://opt-mainnet.g.alchemy.com/v2/${alchemyKey}`),
    [base.id]: http(`https://base-mainnet.g.alchemy.com/v2/${alchemyKey}`),
    [bsc.id]: http('https://bsc-dataseed.binance.org'),
  },
  ssr: true,
});
```

---

## Database Issues

### 7. Database Tables Not Found

**Error:**
```
PrismaClientKnownRequestError: Table does not exist
```

**Cause:** Local PostgreSQL database is empty and needs schema initialization.

**Solution:**

1. Create `init-db.sql` with table definitions
2. Run initialization:
```bash
docker-compose exec -T postgres psql -U metrix -d metrix_finance < init-db.sql
```

3. Verify tables exist:
```bash
docker-compose exec postgres psql -U metrix -d metrix_finance -c "\dt"
```

---

## Port Conflicts

### 8. PostgreSQL Port Already Allocated

**Error:**
```
Bind for 0.0.0.0:5432 failed: port is already allocated
```

**Cause:** Another PostgreSQL instance is using port 5432.

**Solution:**
Update `docker-compose.yml` to use a different port:

```yaml
postgres:
  ports:
    - "5433:5432"  # Changed from 5432:5432
```

Note: Internal container connection still uses port 5432, only external host port changes.

---

## Environment Variables

### 9. Missing API Keys

**Symptom:** Pools not loading, blank pages, API errors.

**Solution:**
Ensure all required environment variables are passed in `docker-compose.yml`:

```yaml
app:
  environment:
    DATABASE_URL: postgresql://metrix:metrix_password_123@postgres:5432/metrix_finance
    NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID: ${NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID}
    NEXT_PUBLIC_ALCHEMY_API_KEY: ${NEXT_PUBLIC_ALCHEMY_API_KEY}
    NEXT_PUBLIC_GRAPH_API_KEY: ${NEXT_PUBLIC_GRAPH_API_KEY}
    NEXT_PUBLIC_APP_URL: ${NEXT_PUBLIC_APP_URL:-http://localhost:3000}
    JWT_SECRET: ${JWT_SECRET}
    TOKEN_SALT: ${TOKEN_SALT}
    RESEND_API_KEY: ${RESEND_API_KEY}
    STRIPE_SECRET_KEY: ${STRIPE_SECRET_KEY}
    # ... all other env vars
```

**Verify variables are set:**
```bash
docker-compose exec app printenv | grep NEXT_PUBLIC_
```

---

## Docker Build Optimization

### 10. Slow Build Times

**Solution:**
Use `.dockerignore` to exclude unnecessary files:

```
node_modules
npm-debug.log
.next
.git
.gitignore
*.log
*.md
.DS_Store
coverage
dist
build
```

Note: Do NOT ignore `.env` and `.env.local` as they're needed for the build.

---

## Quick Troubleshooting Commands

```bash
# View logs
docker-compose logs -f app

# Restart containers
docker-compose restart

# Rebuild and restart
docker-compose up -d --build

# Check container status
docker-compose ps

# Access database
docker-compose exec postgres psql -U metrix -d metrix_finance

# Check environment variables
docker-compose exec app printenv

# Stop and remove everything
docker-compose down

# Stop and remove with volumes (fresh start)
docker-compose down -v
```

---

## Complete Fresh Start

If all else fails, complete reset:

```bash
# Stop and remove everything
docker-compose down -v

# Remove Docker images
docker rmi metrix-finance-app

# Rebuild from scratch
docker-compose up -d --build

# Initialize database
docker-compose exec -T postgres psql -U metrix -d metrix_finance < init-db.sql
```

---

## Success Checklist

✅ Docker containers running:
```bash
docker-compose ps
# Should show both metrix-app and metrix-postgres as "Up"
```

✅ App accessible:
```bash
curl http://localhost:3000
# Should return HTML
```

✅ Database initialized:
```bash
docker-compose exec postgres psql -U metrix -d metrix_finance -c "\dt"
# Should show User, Session, VerificationToken, Subscription tables
```

✅ API keys configured:
```bash
docker-compose exec app printenv | grep -E "ALCHEMY|GRAPH|WALLETCONNECT"
# Should show all three API keys
```

✅ No CORS errors in browser console

✅ Pools loading on home page

---

## Last Updated
2026-02-13

For additional help, check the main README.md or project documentation.
