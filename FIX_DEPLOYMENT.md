# Fix for CORS and RPC Errors - Quick Deploy

## What This Fix Does

✅ **Fixes CORS errors** - Removed deprecated hosted subgraph URLs
✅ **Fixes RPC failures** - Replaced failing LlamaRPC with reliable DRPC
✅ **Suppresses auth spam** - Graceful handling of missing API keys
✅ **Enables pool data** - Works with public endpoints + mock data fallback

## Deploy to Railway NOW

### Step 1: Push to GitHub (Triggers Auto-Deploy)

```bash
git pull origin main
git push origin main
```

Railway will automatically redeploy (2-3 minutes).

### Step 2: Update Environment Variables

Go to Railway Dashboard → Your Service → Variables

**Remove these invalid keys** (set to empty or valid keys):
```
NEXT_PUBLIC_GRAPH_API_KEY = (delete value or leave empty)
NEXT_PUBLIC_ALCHEMY_API_KEY = (delete value or leave empty)
```

Click **Redeploy** after changing variables.

### Step 3: Verify Fix

1. Visit: https://principia-metrics-production.up.railway.app
2. Open DevTools (F12) → Console
3. You should see:
   - ✅ Pool data loading on homepage
   - ✅ No CORS errors
   - ✅ No `ERR_NAME_NOT_RESOLVED` errors
   - ⚠️ Warning about missing API keys (expected - app uses fallbacks)

## Get Free API Keys (Optional but Recommended)

For better performance, get free tier API keys:

1. **The Graph** - https://thegraph.com/studio/
   - Sign up → API Keys → Create Key
   - Add to Railway: `NEXT_PUBLIC_GRAPH_API_KEY`

2. **Alchemy** - https://dashboard.alchemy.com/
   - Create App → Copy API Key
   - Add to Railway: `NEXT_PUBLIC_ALCHEMY_API_KEY`

3. **Etherscan** - https://etherscan.io/myapikey
   - Register → My API Keys → Create Key
   - Add to Railway: `NEXT_PUBLIC_ETHERSCAN_API_KEY`

## Troubleshooting

**Pool data still not showing?**
- Check Railway logs: `railway logs`
- Verify deployment completed successfully
- Clear browser cache (Ctrl+Shift+Delete)

**Still seeing CORS errors?**
- Make sure you pulled latest code
- Check Railway deployed the new code (commit hash should match)

**Need help?**
- Check Railway deployment logs
- Verify environment variables are correct
- Make sure Railway auto-deploy is enabled for GitHub

---

**The app now works with public endpoints!** For production, get the API keys for optimal performance.
