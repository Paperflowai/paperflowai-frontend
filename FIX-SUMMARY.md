# Fix Summary: Company Name Auto-Fill Issue

## Problem Identified

The company names **WERE** being saved correctly to the database in both `name` and `company_name` fields, but the frontend was **ONLY** reading from the `name` field. This caused company names to not display if they were only saved in `company_name`.

## Root Cause

Your API (`create-from-gpt/route.ts`) saves company names to **BOTH** fields:
```typescript
name: companyName,          // ← Saved here
company_name: companyName,  // ← AND here
```

But your frontend was only reading `name`:
```typescript
.select('id, name, orgnr, ...')  // ← Missing company_name!
companyName: (row.name || '').trim()  // ← Only checked name
```

## Changes Made

### 1. Dashboard (`src/app/dashboard/page.tsx:577, 587`)

**Before:**
```typescript
.select('id, name, orgnr, email, phone, address, zip, city, country');
//...
companyName: (row.name || '').trim(),
```

**After:**
```typescript
.select('id, name, company_name, orgnr, email, phone, address, zip, city, country');
//...
companyName: (row.name || row.company_name || '').trim(),
```

### 2. Customer Cards API (`src/app/api/customer-cards/get/route.ts`)

**Before:**
```typescript
.select("id,name,orgnr,email,phone,address,zip,city,country,updated_at")
//...
name: kund.namn ?? kund.name ?? result?.name ?? null,
```

**After:**
```typescript
.select("id,name,company_name,orgnr,email,phone,address,zip,city,country,updated_at")
//...
name: kund.namn ?? kund.name ?? kund.company ?? kund.companyName ?? result?.name ?? result?.company_name ?? null,
```

## What This Fixes

✅ Company names will now display correctly even if only `company_name` is populated
✅ Fallback chain now checks BOTH `name` AND `company_name` fields
✅ More robust handling of different field name variations from GPT

## How to Test

### Option 1: Test with existing customers
1. Reload your dashboard: `/dashboard`
2. Clear browser cache (Ctrl+Shift+Delete)
3. Check if company names now appear

### Option 2: Create a new customer via GPT
1. Use your GPT Action to create a new offer
2. Check the dashboard to see if the company name appears
3. Open the customer card to verify all fields are filled

### Option 3: Check database directly
1. Open Supabase Dashboard
2. Go to Table Editor → `customers`
3. Look at both `name` and `company_name` columns
4. If either has a value, it should now display in the UI

## If Company Names Still Don't Show

If the company names still don't appear after this fix, it means the **data isn't being saved** to the database in the first place. This would indicate:

1. **GPT is not sending company names in the expected format**
   - Check what GPT actually sends in the JSON payload
   - Run the test script: `.\test-gpt-api.ps1`

2. **Company names are being filtered out as dates**
   - The `cleanText()` function filters out dates
   - Check backend logs for warnings like:
     ```
     [cleanText] 🚫 Datum filtrerat bort: "..."
     [getCompanyName] ⚠️ Inget företagsnamn hittades!
     ```

3. **Wrong field names in GPT's JSON**
   - GPT should send: `jsonData.kund.namn` or `jsonData.kund.name`
   - Check the OpenAPI schema matches what GPT is sending

## Next Steps

1. ✅ Test the fix by reloading the dashboard
2. If it works: Great! You're done.
3. If it doesn't work:
   - Check what's in the database (`name` and `company_name` columns)
   - Check backend logs when GPT creates an offer
   - Share the logs with me for further debugging

## Files Modified

- ✅ `src/app/dashboard/page.tsx`
- ✅ `src/app/api/customer-cards/get/route.ts`
- 📝 `DIAGNOSIS.md` (diagnosis documentation)
- 📝 `FIX-SUMMARY.md` (this file)
