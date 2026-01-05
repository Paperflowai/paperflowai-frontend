# Fix Vercel Build Cache Issue

## Problem
Vercel is caching the old corrupt version of `parse/route.ts` even though we fixed the UTF-8 encoding.

## Solution Options (Try in Order)

### Option 1: Clear Vercel Build Cache (Easiest)

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project
3. Go to **Settings** → **General**
4. Scroll to **Build & Development Settings**
5. Click **Clear Build Cache**
6. Go to **Deployments**
7. Click **Redeploy** on the latest deployment

### Option 2: Force Empty Commit

```bash
# Create an empty commit to force rebuild
git commit --allow-empty -m "Force rebuild - clear cache"
git push
```

### Option 3: Modify Vercel Config

Add this to `vercel.json` (or create it):

```json
{
  "buildCommand": "npm run build",
  "framework": "nextjs"
}
```

Then commit and push:
```bash
git add vercel.json
git commit -m "Add vercel.json to force clean build"
git push
```

### Option 4: Delete .next Cache Manually

Add this to your build command in Vercel:

1. Go to Vercel Dashboard → Project Settings
2. Build & Development Settings
3. Build Command: `rm -rf .next && npm run build`
4. Save
5. Redeploy

## Verify the Fix Worked

After rebuilding, check the build log. You should see:
```
✓ Building completed
✓ Compiled successfully
```

Instead of:
```
✗ Failed to read source code
✗ stream did not contain valid UTF-8
```

## Why This Happened

1. Original file had corrupted Swedish characters (å→�, ä→�, ö→�)
2. We fixed it and committed UTF-8 version
3. Vercel cached the corrupt version in build cache
4. Even with correct file in git, cache serves old version
5. Clearing cache forces Vercel to read fresh files

## Confirmation

Run this locally to confirm file is good:
```bash
file src/app/api/offers/parse/route.ts
# Should show: UTF-8 text
```
