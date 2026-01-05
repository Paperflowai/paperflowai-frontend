# Debug: "OKÄNT FÖRETAG" Problem

## Problem
Kundnamnet visas som "OKÄNT FÖRETAG" men denna sträng finns INTE i koden!

## Sökresultat
✅ Sökt i ALLA filer (.ts, .tsx, .js, .jsx, .sql, .json)
✅ Sökt i databas-schemas
✅ Sökt i migrations

❌ "OKÄNT FÖRETAG" finns INTE i koden

## Möjliga orsaker

### 1. Data i databasen
Strängen kan vara sparad direkt i Supabase `customers` tabellen.

**Kolla detta:**
1. Öppna Supabase Dashboard
2. Gå till Table Editor → `customers`
3. Titta på kolumnerna `name` och `company_name`
4. Finns det en rad med "OKÄNT FÖRETAG"?

### 2. localStorage cache
Gammal data från innan fix kan ligga kvar i localStorage.

**Testa detta:**
1. Öppna DevTools (F12)
2. Console tab
3. Kör: `localStorage.clear()`
4. Reload sidan (Ctrl+R)

### 3. Visuell förvirring
Kanske visas något annat som du tolkar som "OKÄNT FÖRETAG":
- "Namnlös kund" (finns i kod på rad 878 i dashboard)
- "Okänd kund" (finns i customerUtils.ts)
- Tomt fält / ingen text

**Kolla detta:**
- VAR exakt ser du "OKÄNT FÖRETAG"?
  - I kundlistan på dashboard?
  - På kundkortet?
  - I GPT:ens svar?
  - Någon annanstans?

### 4. GPT skickar detta värde
GPT:en kanske skickar "OKÄNT FÖRETAG" som företagsnamn.

**Testa detta:**
1. Kör: `npm run dev`
2. Skapa en ny offert via GPT
3. Kolla backend-loggar för:
   ```
   [create-from-gpt] 🏢 Resultat companyName: ???
   ```
4. Vad står det?

## Felsökningssteg (GÖR DETTA NU)

### Steg 1: Kolla databasen
```sql
-- Kör detta i Supabase SQL Editor
SELECT id, name, company_name, email, created_at
FROM customers
ORDER BY created_at DESC
LIMIT 10;
```

Vad ser du i `name` och `company_name` kolumnerna?

### Steg 2: Kolla localStorage
Öppna DevTools (F12) → Console → Kör:
```javascript
// Se alla kunder i localStorage
JSON.parse(localStorage.getItem('paperflow_customers_v1') || '[]')

// Rensa allt
localStorage.clear()
```

### Steg 3: Skapa en testoffert
1. Använd GPT:en för att skapa en offert
2. Ge kunden namnet "Test Company AB"
3. Kolla vad som sparas i databasen
4. Kolla vad som visas på dashboard

### Steg 4: Kolla backend-loggar
```bash
npm run dev
```

När du skapar en offert, se efter dessa loggar:
```
[create-from-gpt] 📦 Raw jsonData: { ... }
[create-from-gpt] 👤 kund-object: { ... }
[create-from-gpt] 🏢 Resultat companyName: ???  ← Vad står här?
```

## Nästa steg

**SVARA PÅ DESSA FRÅGOR:**

1. **Var ser du "OKÄNT FÖRETAG"?**
   - [ ] I kundlistan på /dashboard
   - [ ] På kundkortet /kund/[id]
   - [ ] I GPT:ens svar
   - [ ] Annat: _______________

2. **Vad visas i databasen?**
   - Kör SQL-query ovan och kopiera resultatet

3. **Vad visas i DevTools Console?**
   - Kör `JSON.parse(localStorage.getItem('paperflow_customers_v1') || '[]')`
   - Kopiera resultatet

4. **Har du rensat localStorage?**
   - [ ] Ja, körde `localStorage.clear()` och laddade om
   - [ ] Nej, inte än

5. **Backend-loggar?**
   - När du skapar en offert, vad står det vid `[create-from-gpt] 🏢 Resultat companyName:`?

## Snabbfix (om det är localStorage)

Om det är gammal cache i localStorage:

1. DevTools (F12) → Application → Storage → Clear Site Data
2. Eller kör i Console:
   ```javascript
   localStorage.clear()
   indexedDB.deleteDatabase('paperflow-docs')
   indexedDB.deleteDatabase('paperflow-bk')
   location.reload()
   ```

## Om "OKÄNT FÖRETAG" kommer från GPT

Om GPT skickar "OKÄNT FÖRETAG" istället för ett riktigt företagsnamn:

1. Kolla GPT:ens instruktioner
2. Kolla OpenAPI-schemat
3. Be GPT att ALLTID skicka ett riktigt företagsnamn i `jsonData.kund.namn`

**GPT:ens JSON borde se ut så här:**
```json
{
  "jsonData": {
    "kund": {
      "namn": "Riktig Firma AB",  // ← INTE "OKÄNT FÖRETAG"!
      "email": "info@firma.se",
      "telefon": "070-123 45 67"
    }
  },
  "textData": "..."
}
```
