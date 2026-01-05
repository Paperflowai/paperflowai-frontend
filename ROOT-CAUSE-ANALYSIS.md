# Root Cause Analysis: "OKÄNT FÖRETAG" Problem

## What's Happening (Step-by-Step)

### Timeline of Events:

1. **User writes company name in offer text** ✅
   - Example: "Skapa offert för Acme AB"

2. **GPT processes the text** ⚠️
   - GPT reads the text
   - GPT should extract company name → `jsonData.kund.namn`
   - **BUT**: Sometimes GPT sends `jsonData.kund.namn = null` or missing

3. **API receives the request** ❌
   - `create-from-gpt/route.ts` receives:
     ```json
     {
       "jsonData": {
         "kund": {
           "namn": null  // ← MISSING!
         }
       }
     }
     ```

4. **Backend uses fallback** 🔒
   - Line 74: `getCompanyName()` returns fallback
   - Fallback value: **"OKÄNT FÖRETAG"** (from GPT's custom instructions)
   - Customer is INSERTED into database with `company_name = "OKÄNT FÖRETAG"`

5. **GPT realizes the mistake later** 💡
   - GPT parses the text again
   - GPT says: "Do you want to update customer to Acme AB?"
   - User says: YES

6. **Nothing happens** ❌
   - **NO UPDATE ENDPOINT EXISTS**
   - GPT has nowhere to send the update
   - "OKÄNT FÖRETAG" stays forever in database

---

## The Root Causes

### Primary Cause: GPT Schema Issue
**WHERE:** GPT's JSON parsing
**WHY:** GPT sometimes fails to extract `kund.namn` from the text on first pass

**Example of what GPT sends:**
```json
{
  "jsonData": {
    "kund": {
      "namn": null,  // ← Should be "Acme AB"
      "epost": "info@acme.se"
    }
  }
}
```

### Secondary Cause: No Update Mechanism
**WHERE:** `/api/customers/[id]/route.ts`
**WHY:** Only DELETE exists, no PATCH/PUT endpoint

**What happens:**
- GPT realizes company name later
- GPT wants to update the customer
- **No API endpoint to call**
- Update never happens

---

## Why the Timing Issue Occurs

### The Problem:
GPT extracts customer data in **TWO PHASES**:

**Phase 1: Initial Creation (Fast)**
- GPT quickly parses user input
- Tries to extract company name
- Sometimes misses it or gets confused
- Sends incomplete data to API
- Fallback "OKÄNT FÖRETAG" is used

**Phase 2: Post-Processing (Accurate)**
- GPT re-reads the full text
- NOW correctly identifies company name
- Asks user to confirm update
- **But has no way to send the update**

---

## The Fix (Minimal, No Refactor)

### Part 1: Create UPDATE Endpoint

**FILE:** `src/app/api/customers/[id]/route.ts`

**ADD:** PATCH method that:
1. Accepts `{ company_name: "New Name" }`
2. Reads current `company_name` from database
3. Only updates if current value is:
   - "OKÄNT FÖRETAG"
   - "Ny kund"
   - NULL
   - Empty string
4. Returns updated customer

**Logic:**
```typescript
// Only update if placeholder
if (currentName === "OKÄNT FÖRETAG" ||
    currentName === "Ny kund" ||
    !currentName) {
  // Safe to update
}
```

### Part 2: Add to GPT Schema

**FILE:** `gpt-action-schema.json`

**ADD:** New endpoint:
```json
"/api/customers/{customerId}": {
  "patch": {
    "operationId": "updateCustomer",
    "summary": "Update customer name",
    "parameters": [{
      "name": "customerId",
      "in": "path",
      "required": true
    }],
    "requestBody": {
      "content": {
        "application/json": {
          "schema": {
            "properties": {
              "company_name": { "type": "string" }
            }
          }
        }
      }
    }
  }
}
```

### Part 3: Update GPT Instructions

**FILE:** `gpt-instructions-example.txt`

**ADD:** After offer creation:
```
If you notice the company name was missing during creation,
immediately call updateCustomer with the correct name.
```

---

## How This Fixes It

### Before Fix:
```
User: "Create offer for Acme AB"
  ↓
GPT sends: kund.namn = null
  ↓
Backend saves: "OKÄNT FÖRETAG"
  ↓
GPT asks: "Update to Acme AB?"
  ↓
User: "Yes"
  ↓
❌ NO ENDPOINT → Nothing happens
```

### After Fix:
```
User: "Create offer for Acme AB"
  ↓
GPT sends: kund.namn = null
  ↓
Backend saves: "OKÄNT FÖRETAG"
  ↓
GPT realizes mistake
  ↓
GPT calls: PATCH /api/customers/{id} { company_name: "Acme AB" }
  ↓
Backend checks: current = "OKÄNT FÖRETAG" → OK to update
  ↓
✅ Database updated to "Acme AB"
```

---

## Implementation Steps

1. ✅ Add PATCH method to `/api/customers/[id]/route.ts`
2. ✅ Add update endpoint to `gpt-action-schema.json`
3. ✅ Update GPT instructions to use the endpoint
4. ✅ Test the flow

---

## Important Notes

- **No UI changes** - all backend
- **No new tables** - uses existing `customers` table
- **Keeps fallback** - "OKÄNT FÖRETAG" still used initially
- **Simple logic** - only overwrites placeholders
- **Works same-request** - can update immediately after insert

---

## Expected Behavior After Fix

### Scenario 1: GPT Gets Name Right First Time
```
GPT → company_name: "Acme AB"
Backend → Saves "Acme AB"
✅ Done
```

### Scenario 2: GPT Misses Name Initially
```
GPT → company_name: null
Backend → Saves "OKÄNT FÖRETAG"
GPT → Realizes mistake → PATCH company_name: "Acme AB"
Backend → Checks: "OKÄNT FÖRETAG" → Updates to "Acme AB"
✅ Fixed automatically
```

### Scenario 3: User Manually Changed Name
```
Backend → company_name: "User's Custom Name"
GPT → Tries to update to "Acme AB"
Backend → Checks: NOT a placeholder → Rejects update
✅ Protected from overwriting user data
```
