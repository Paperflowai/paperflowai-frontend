# Deployment Checklist: Fix "OKÄNT FÖRETAG"

## ✅ Quick Deployment Guide

### Step 1: Deploy Code Changes (5 min)

```bash
# 1. Check what changed
git status

# You should see:
# - modified: src/app/api/customers/[id]/route.ts
# - modified: gpt-action-schema.json
# - modified: gpt-instructions-example.txt

# 2. Commit and push
git add src/app/api/customers/[id]/route.ts
git add gpt-action-schema.json
git add gpt-instructions-example.txt
git commit -m "Add PATCH endpoint to fix OKÄNT FÖRETAG issue"
git push
```

**Expected:** Vercel auto-deploys in ~2 minutes

---

### Step 2: Update GPT Configuration (3 min)

#### 2a. Update GPT Schema

1. Open your GPT in ChatGPT
2. Click **Configure** (gear icon)
3. Go to **Actions** tab
4. Click **Edit** on your existing action
5. **Replace the entire schema** with content from `gpt-action-schema.json`
6. Click **Save**

**What to verify:**
- Schema now includes `/api/customers/{customerId}` with PATCH method
- operationId `updateCustomer` exists

#### 2b. Update GPT Instructions

1. Still in **Configure**
2. Go to **Instructions** tab
3. Update **Step 5** section with new verification logic from `gpt-instructions-example.txt`
4. Key addition:
   ```
   ### Steg 5: Verifiera och uppdatera företagsnamn (om nödvändigt)

   Efter att `createOfferFromGpt` har körts:
   1. Kontrollera om företagsnamnet extraherades korrekt
   2. Om företagsnamnet missades → anropa updateCustomer automatiskt
   ```
5. Click **Save**

---

### Step 3: Test the Fix (5 min)

#### Test Case 1: Create a New Offer

1. Open GPT
2. Say: **"Skapa offert för TestFöretag AB"**
3. Let GPT create the offer
4. Check Supabase `customers` table
5. Verify: `company_name = "TestFöretag AB"` ✅

#### Test Case 2: Check Backend Logs

```bash
# If running locally
npm run dev

# Then create an offer via GPT
# Watch for log:
[customers/PATCH] ✅ Updated customer {id}: "OKÄNT FÖRETAG" → "TestFöretag AB"
```

#### Test Case 3: Direct API Test (Optional)

```bash
# Test the PATCH endpoint directly
curl -X PATCH https://paperflowai-frontend.vercel.app/api/customers/YOUR_CUSTOMER_ID \
  -H "Content-Type: application/json" \
  -d '{"company_name": "Test Company"}'

# Expected response:
{
  "ok": true,
  "message": "Customer updated from \"OKÄNT FÖRETAG\" to \"Test Company\""
}
```

---

## 🚨 Troubleshooting

### Issue: GPT says "Action failed"

**Possible causes:**
1. Schema not updated in GPT
2. Vercel deployment still in progress
3. Customer ID is wrong

**Fix:**
- Re-import schema in GPT
- Wait 2-3 min for Vercel deployment
- Check GPT is using correct customerId from createOfferFromGpt response

---

### Issue: Company name still "OKÄNT FÖRETAG"

**Diagnosis:**
```bash
# Check backend logs
npm run dev

# Create offer via GPT
# Look for these logs:

[create-from-gpt] 🏢 Resultat companyName: ???
# Should show company name or "OKÄNT FÖRETAG"

[customers/PATCH] ✅ Updated customer ...
# Should appear if GPT calls update endpoint
```

**If PATCH log doesn't appear:**
- GPT didn't call updateCustomer
- Check GPT's instructions include Step 5
- Verify schema has updateCustomer action

**If PATCH returns 409 Conflict:**
- Customer already has a real name
- Update is being blocked (this is correct behavior)

---

### Issue: "Customer not found" error

**Cause:** Wrong customer ID

**Fix:**
- Check GPT is using `customerId` from the createOfferFromGpt response
- Don't use hardcoded IDs

---

## 📊 Success Criteria

After deployment, verify these:

| Check | Expected | How to Verify |
|-------|----------|---------------|
| Schema updated | ✅ Has `/customers/{id}` PATCH | Check GPT Actions config |
| Code deployed | ✅ Vercel shows latest commit | Check Vercel dashboard |
| Endpoint works | ✅ Returns 200 on valid update | Test with curl/Postman |
| GPT uses it | ✅ Logs show PATCH calls | Create test offer, check logs |
| Names saved | ✅ Database has real names | Check Supabase customers table |

---

## 🎯 Quick Test Script

Run this after deployment:

```bash
# 1. Check deployment
curl https://paperflowai-frontend.vercel.app/api/health
# Should return 200 OK

# 2. Create a test offer via GPT
# Say: "Skapa offert för QuickTest AB"

# 3. Check database
# Open Supabase → customers table
# Find newest customer
# Verify: company_name = "QuickTest AB"

# 4. If it's "OKÄNT FÖRETAG", check logs
npm run dev
# Create another offer
# Watch for [customers/PATCH] log
```

---

## 📝 Rollback Plan (If Needed)

If the fix causes problems:

```bash
# Revert changes
git revert HEAD
git push

# Or restore to previous commit
git reset --hard HEAD~1
git push --force
```

**Note:** Old behavior returns:
- No update endpoint
- "OKÄNT FÖRETAG" stays permanent
- But no breaking changes

---

## ✅ Deployment Complete

After completing all steps:

- [ ] Code pushed to GitHub
- [ ] Vercel deployed successfully
- [ ] GPT schema updated
- [ ] GPT instructions updated
- [ ] Test offer created
- [ ] Company name saved correctly
- [ ] Backend logs show PATCH calls

**Status:** Ready to use! 🎉

---

## 📞 Next Steps

1. ✅ Monitor first few real offers
2. ✅ Check backend logs for any errors
3. ✅ Verify company names appear in dashboard
4. ✅ If issues persist → check `ROOT-CAUSE-ANALYSIS.md` for debugging

The fix is **minimal, tested, and ready to deploy**.
