# Company Name Not Showing - Diagnosis

## What I Found

After analyzing your code, here's what's happening:

### Backend (API) - `src/app/api/offers/create-from-gpt/route.ts`
✅ **CORRECTLY** extracts company name using `getCompanyName()` (lines 46-85)
✅ **CORRECTLY** filters out dates using `looksLikeDate()` and `cleanText()`
✅ **CORRECTLY** saves to BOTH `name` AND `company_name` fields (lines 228-229)

```typescript
// Line 228-229
name: companyName,
company_name: companyName,
```

### Frontend - `src/app/dashboard/page.tsx`
The dashboard loads customers from Supabase (line 575-577):
```typescript
.from('customers')
.select('id, name, orgnr, email, phone, address, zip, city, country');
```

**Line 587** maps the data:
```typescript
companyName: (row.name || '').trim(),
```

**Line 878** displays it:
```typescript
{kund.companyName || 'Namnlös kund'}
```

## The Problem

The issue is that "OKÄNT FÖRETAG" (Unknown Company) **does not exist in your codebase**.

However, I found these fallbacks:
- `'Namnlös kund'` (Nameless customer) - dashboard line 878
- `'Okänd kund'` (Unknown customer) - customerUtils.ts line 14
- `"Ny kund"` (New customer) - create-from-gpt line 74

## Most Likely Cause

**The company name IS being saved correctly to the database, but:**

1. **The `name` field might be `NULL` in the database** because:
   - GPT is not sending the company name in any of the expected field names
   - OR the company name looks like a date and gets filtered out
   - OR there's a mismatch in field names

2. **You're looking at old cached data in localStorage**
   - The frontend caches customer data in localStorage
   - Old data may not have `companyName` set

## How to Diagnose

### Step 1: Check what GPT actually sends
In your GPT conversation, after creating an offer, look for the JSON payload. It should look like:

```json
{
  "jsonData": {
    "kund": {
      "namn": "Company AB",        // ← Check this exists!
      "email": "test@company.se",
      "phone": "070-123 45 67"
    }
  },
  "textData": "..."
}
```

### Step 2: Check backend logs
Run `npm run dev` locally and check console output when GPT creates an offer:

```
[create-from-gpt] 📦 Raw jsonData: { ... }
[create-from-gpt] 👤 kund-object: { namn: "...", ... }
[create-from-gpt] 🏢 Resultat companyName: ???   ← What shows here?
[create-from-gpt] 📊 Extraherade värden:
  companyName: ???    ← And here?
```

### Step 3: Check Supabase database directly
1. Open Supabase Dashboard
2. Go to Table Editor
3. Select `customers` table
4. Find your test customer
5. Check the `name` column - what value does it have?

### Step 4: Clear browser cache
1. Open DevTools (F12)
2. Application tab
3. Clear storage
4. Reload page

## Quick Fix to Try

The dashboard query (line 577) doesn't include `company_name` as a fallback!

**Current:**
```typescript
.select('id, name, orgnr, email, phone, address, zip, city, country');
```

**Should be:**
```typescript
.select('id, name, company_name, orgnr, email, phone, address, zip, city, country');
```

And line 587 should try both:
```typescript
companyName: (row.name || row.company_name || '').trim(),
```

## Test This

1. Check what's in the database `customers` table `name` field
2. If it's NULL but `company_name` has a value → Fix the dashboard query
3. If BOTH are NULL → GPT is not sending the company name correctly
4. If both have values → Check browser cache/localStorage

Would you like me to:
1. Fix the dashboard to read from both `name` and `company_name`?
2. Add more debugging to see what GPT actually sends?
3. Create a test script to verify the API works correctly?
