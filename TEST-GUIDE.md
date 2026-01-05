# Guide: Testa Alla API-Endpoints

## 🎯 Vad Detta Gör

Testar alla API-endpoints i systemet och visar var problemen är.

---

## 🚀 Hur Man Kör

### Alternativ 1: Node.js Script (Rekommenderad)

```bash
# 1. Starta dev-servern
npm run dev

# 2. I en ny terminal, kör test-scriptet
node test-all-endpoints.js
```

### Alternativ 2: PowerShell Script

```powershell
# 1. Starta dev-servern
npm run dev

# 2. I en ny PowerShell, kör:
.\test-endpoints.ps1
```

### Alternativ 3: Testa Production

```bash
# Sätt BASE_URL till din Vercel URL
BASE_URL=https://paperflowai-frontend.vercel.app node test-all-endpoints.js
```

---

## 📊 Vad Testas

### ✅ Customer Endpoints
- `GET /api/customer-cards/get` - Hämta kundkort
- `PATCH /api/customers/{id}` - Uppdatera företagsnamn
- `DELETE /api/customers/{id}` - Ta bort kund

### ✅ Offer Endpoints
- `POST /api/offers/create-from-gpt` - Skapa offert från GPT
- `GET /api/offers/list` - Lista offerter
- `POST /api/offers/parse` - Parsa PDF (placeholder)
- `POST /api/offers/delete` - Ta bort offert
- `POST /api/offers/update-status` - Uppdatera status

### ✅ Document Endpoints
- `GET /api/customers/{id}/documents` - Hämta dokument

### ✅ Email Endpoint
- `POST /api/sendEmail` - Skicka e-post

### ✅ GPT Endpoint
- `POST /api/gpt` - GPT-integration

---

## 📝 Tolka Resultaten

### ✓ PASS (Grönt)
```
✓ PASS - Status: 200
```
**Betydelse:** Endpoint fungerar korrekt

### ✗ FAIL (Rött)
```
✗ FAIL - Status: 500 (Expected: 200)
  Error: Internal server error
```
**Betydelse:** Endpoint har problem som måste fixas

### ⊘ SKIPPED (Gult)
```
⊘ SKIPPED - Requires authentication
```
**Betydelse:** Test hoppades över (ofta OK)

---

## 🔍 Exempel på Output

```
=============================================================
Testing API Endpoints
Base URL: http://localhost:3000
=============================================================

=== CUSTOMER ENDPOINTS ===

Testing: PATCH /api/customers/test-123
✓ PASS - Status: 404

Testing: DELETE /api/customers/test-123
✓ PASS - Status: 404

=== OFFER ENDPOINTS ===

Testing: POST /api/offers/create-from-gpt
✓ PASS - Status: 200

Testing: POST /api/offers/parse
✓ PASS - Status: 501

=============================================================
TEST RESULTS
=============================================================

✓ PASSED: 8
✗ FAILED: 2

Pass Rate: 80.0%
=============================================================
```

---

## 🐛 Vanliga Problem

### Problem 1: "Connection refused"
```
✗ ERROR - connect ECONNREFUSED
```

**Lösning:**
```bash
# Starta dev-servern först
npm run dev
```

### Problem 2: "404 Not Found"
```
✗ FAIL - Status: 404
```

**Lösning:**
- Kolla att endpoint finns i `src/app/api/`
- Verifiera att route.ts-filen exporterar rätt metod (GET, POST, etc.)

### Problem 3: "500 Internal Server Error"
```
✗ FAIL - Status: 500
  Error: Database connection failed
```

**Lösning:**
- Kolla `.env.local` - finns SUPABASE keys?
- Kolla Supabase Dashboard - är databasen uppe?
- Kolla terminal-loggar för detaljerat felmeddelande

### Problem 4: "501 Not Implemented"
```
✓ PASS - Status: 501
```

**Betydelse:**
- Detta är OK för `/api/offers/parse` (vår placeholder)
- Andra endpoints ska INTE returnera 501

---

## 📋 Endpoints Som Testas

| Endpoint | Metod | Förväntat | Vad Det Gör |
|----------|-------|-----------|-------------|
| `/api/customers/{id}` | PATCH | 404/409/200 | Uppdatera företagsnamn |
| `/api/customers/{id}` | DELETE | 404/200 | Ta bort kund |
| `/api/customer-cards/get` | GET | 200/404 | Hämta kundkort |
| `/api/offers/create-from-gpt` | POST | 200 | Skapa offert från GPT |
| `/api/offers/list` | GET | 200 | Lista offerter |
| `/api/offers/parse` | POST | 501 | Parsa PDF (disabled) |
| `/api/offers/delete` | POST | 200/404 | Ta bort offert |
| `/api/offers/update-status` | POST | 200/404 | Uppdatera status |
| `/api/customers/{id}/documents` | GET | 200 | Hämta dokument |
| `/api/sendEmail` | POST | 200/400 | Skicka e-post |
| `/api/gpt` | POST | 200/400 | GPT-integration |

---

## 🎯 Förväntat Resultat

### Alla Endpoints Fungerar:
```
Pass Rate: 100.0%
✓ All tests passed!
```

### Några Problem (Normalt):
```
Pass Rate: 90.0%
⚠ Some tests failed. Check details above.
```

**Vanliga "failures" som är OK:**
- 404 för test-kunder som inte finns ✅
- 501 för parse-endpoint (placeholder) ✅
- 400 för ogiltiga test-data ✅

**Riktiga problem:**
- 500 Internal Server Error ❌
- Connection errors ❌
- Timeout errors ❌

---

## 🔧 Felsökning

### Kör Ett Specifikt Test

Öppna `test-all-endpoints.js` och kommentera ut andra tester:

```javascript
// Kommentera ut det du inte vill testa
// await testEndpoint('List offers', 'GET', '/api/offers/list');

// Kör bara detta
await testEndpoint('Create offer from GPT', 'POST', '/api/offers/create-from-gpt', {...});
```

### Se Detaljerad Output

```bash
# Kör med debug-mode
DEBUG=* node test-all-endpoints.js
```

### Testa Manuellt med curl

```bash
# Test PATCH endpoint
curl -X PATCH http://localhost:3000/api/customers/test-123 \
  -H "Content-Type: application/json" \
  -d '{"company_name":"Test AB"}'

# Test POST endpoint
curl -X POST http://localhost:3000/api/offers/create-from-gpt \
  -H "Content-Type: application/json" \
  -d @test-data.json
```

---

## 📌 Efter Fix av Problem

1. **Kör tester igen:**
   ```bash
   node test-all-endpoints.js
   ```

2. **Verifiera Pass Rate ökat:**
   ```
   Pass Rate: 95.0% → 100.0%
   ```

3. **Commit ändringar:**
   ```bash
   git add .
   git commit -m "Fix: endpoint XYZ now works"
   git push
   ```

4. **Testa på production:**
   ```bash
   BASE_URL=https://paperflowai-frontend.vercel.app node test-all-endpoints.js
   ```

---

## ✅ Checklista

Innan du kör tester:

- [ ] `.env.local` finns och har rätt värden
- [ ] `npm install` är kört
- [ ] `npm run dev` är igång
- [ ] Supabase är uppe och nåbar
- [ ] Inga syntax-fel i koden

Efter tester:

- [ ] Alla kritiska endpoints fungerar (200/201)
- [ ] Inga 500-fel (om det finns, fixa dem!)
- [ ] Loggar ser bra ut i terminal
- [ ] Pass Rate > 90%

---

**Nu kan du enkelt se exakt vilka endpoints som fungerar och vilka som behöver fixas!** 🎯
