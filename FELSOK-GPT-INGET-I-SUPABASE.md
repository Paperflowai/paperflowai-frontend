# Felsökning: GPT Skapar Offert Men Inget Syns I Supabase

## 🔍 Checklista

Gå igenom detta steg för steg:

---

## ✅ Steg 1: Kolla Om GPT Anropade API:et

### I GPT-chatten, leta efter:

**BRA TECKEN (API anropades):**
```
✅ Offerten har skapats och sparats!
📋 Kund-ID: [något-uuid]
📄 Offert-ID: [något-id]
🔗 PDF-URL: [https://...]
```

**DÅLIGT TECKEN (API misslyckades):**
```
❌ Det gick inte att spara offerten
❌ Systemet meddelade ett tekniskt fel
❌ 500 Internal Server Error
❌ Action failed
```

**VÄRSTA TECKEN (API anropades inte alls):**
```
GPT skrev bara text utan att anropa Action
Ingen URL visades
Inget Kund-ID visades
```

---

## 🔍 Steg 2: Kolla Backend-Loggar

### Om du kör lokalt (`npm run dev`):

**Kolla terminalen:**

**BRA:**
```
[create-from-gpt] 📦 Raw jsonData: { ... }
[create-from-gpt] 👤 kund-object: { ... }
[create-from-gpt] 🏢 Resultat companyName: "..."
[create-from-gpt] ✅ Customer data saved: { customerId: "...", companyName: "..." }
[create-from-gpt] ✅ Customer cards saved
[create-from-gpt] 📄 PDF generated and uploaded
POST /api/offers/create-from-gpt 200 in 2345ms
```

**DÅLIGT:**
```
[create-from-gpt] Customer upsert error: ...
[create-from-gpt] ❌ VARNING: Inget företagsnamn hittades!
POST /api/offers/create-from-gpt 500 in 1234ms
Error: ...
```

**VÄRSTA (ingenting):**
```
(Tom terminal - ingen aktivitet)
```
→ GPT anropade inte API:et alls

---

### Om du kör på Vercel (produktion):

1. Gå till [Vercel Dashboard](https://vercel.com/dashboard)
2. Välj ditt projekt
3. Klicka på "Logs"
4. Filtrera på "create-from-gpt"
5. Kolla om det finns några loggar

**Om inga loggar:**
→ API:et anropades aldrig

---

## 🔍 Steg 3: Kolla Rätt Tabell I Supabase

### Du ska kolla 3 tabeller:

#### 1. `customers` (kunder)
```
Öppna Supabase → Table Editor → customers
Sortera på: created_at DESC (nyaste först)
Leta efter: Rad skapad nyligen
```

#### 2. `offers` (offerter)
```
Öppna Supabase → Table Editor → offers
Sortera på: created_at DESC
Leta efter: Rad skapad nyligen
```

#### 3. `documents` (dokument)
```
Öppna Supabase → Table Editor → documents
Sortera på: created_at DESC
Leta efter: Rad skapad nyligen
```

**Om ALLA 3 tabeller är tomma:**
→ Inget sparades → API-fel eller anropades inte

---

## 🔍 Steg 4: Testa API:et Direkt

### Kör detta för att testa om API:et fungerar:

```bash
# I terminalen:
curl -X POST http://localhost:3000/api/offers/create-from-gpt \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": null,
    "textData": "# OFFERT\n\nKund: Test AB\nE-post: test@test.se\n\nTjänst: Test\nPris: 1000 kr",
    "jsonData": {
      "titel": "Test",
      "summa": 1000,
      "valuta": "SEK",
      "kund": {
        "namn": "Test AB",
        "epost": "test@test.se",
        "telefon": "070-123 45 67"
      }
    }
  }'
```

**Förväntat svar:**
```json
{
  "ok": true,
  "customerId": "...",
  "documentId": "...",
  "offerId": "...",
  "pdfUrl": "...",
  "customerData": { ... }
}
```

**Om du får 500 eller error:**
→ Backend har problem

---

## 🔍 Steg 5: Kolla GPT Action-Konfiguration

### I ChatGPT (Custom GPT):

1. Öppna din GPT
2. Klicka "Configure"
3. Gå till "Actions"
4. Kolla:

**URL:**
```
✅ RÄTT: https://paperflowai-frontend.vercel.app
❌ FEL: http://localhost:3000 (om du inte kör lokalt)
❌ FEL: gammal URL
```

**Schema:**
```
✅ Har importerat gpt-action-schema.json
✅ operationId "createOfferFromGpt" finns
❌ Gammalt schema
```

**Test:**
```
Klicka "Test" i Actions
Skicka en test-request
Se om det fungerar
```

---

## 🔍 Steg 6: Kolla Miljövariabler

### I Vercel:

1. Gå till Vercel Dashboard
2. Settings → Environment Variables
3. Kolla att dessa finns:

```
NEXT_PUBLIC_SUPABASE_URL = https://[ditt-projekt].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY = [din-anon-key]
SUPABASE_SERVICE_ROLE_KEY = [din-service-key]
```

**Om de saknas:**
→ Backend kan inte koppla till Supabase

---

## 🐛 Vanliga Problem & Lösningar

### Problem 1: GPT Säger "Action Failed"

**Orsak:**
- URL i GPT Action är fel
- API:et returnerar 500-fel
- Schema matchar inte API:et

**Lösning:**
1. Kolla URL i GPT Actions
2. Testa API:et direkt (curl)
3. Uppdatera schema

---

### Problem 2: GPT Skriver Bara Text (Inget Action-Anrop)

**Orsak:**
- GPT glömde att anropa Action
- GPT är inte konfigurerad att använda Actions
- Schema saknas

**Lösning:**
1. I GPT Instructions, lägg till:
   ```
   VIKTIGT: Efter att du har genererat offerten,
   anropa ALLTID Action "createOfferFromGpt"
   ```
2. Verifiera att schema är importerat
3. Testa manuellt: "Anropa createOfferFromGpt nu"

---

### Problem 3: API Returnerar 500

**Orsak:**
- Supabase-koppling funkar inte
- Fel i backend-kod
- Saknade miljövariabler

**Lösning:**
1. Kolla backend-loggar för detaljer
2. Kolla Supabase är uppe
3. Kolla miljövariabler

---

### Problem 4: Data Sparas Men Syns Inte

**Orsak:**
- Fel Supabase-projekt öppnat
- Fel tabell
- Fel databas (production vs staging)

**Lösning:**
1. Dubbelkolla Supabase URL i .env
2. Kolla alla 3 tabeller: customers, offers, documents
3. Sök på customer_id eller offer_id från GPT-svaret

---

## 🎯 Snabb Diagnos

### Scenario A: GPT Visade Kund-ID Men Inget I Supabase

**Möjliga orsaker:**
1. Fel Supabase-projekt öppnat
2. Data finns men du kollar fel tabell
3. Fel environment (dev vs prod)

**Lösning:**
```sql
-- Sök på Kund-ID som GPT visade:
SELECT * FROM customers WHERE id = '[kund-id från GPT]';
SELECT * FROM offers WHERE customer_id = '[kund-id från GPT]';
```

---

### Scenario B: GPT Säger "Sparad" Men Inget ID Visas

**Möjliga orsaker:**
1. GPT ljuger (Action misslyckades egentligen)
2. API returnerade fel format

**Lösning:**
- Kolla backend-loggar
- Testa API direkt

---

### Scenario C: Ingenting Händer Alls

**Möjliga orsaker:**
1. GPT Action anropades aldrig
2. URL är fel
3. Schema saknas

**Lösning:**
1. Be GPT explicit: "Anropa createOfferFromGpt Action nu"
2. Kolla Actions-konfiguration
3. Re-importera schema

---

## 📝 Debug-Checklist

Kryssa av när du kollat:

**GPT:**
- [ ] GPT visade Kund-ID efter offert skapades
- [ ] GPT visade PDF-URL
- [ ] Inget felmeddelande från GPT
- [ ] Actions är konfigurerat i GPT
- [ ] Schema är importerat

**Backend:**
- [ ] `npm run dev` är igång (om lokalt)
- [ ] Backend-loggar visar create-from-gpt anrop
- [ ] Inga 500-fel i loggar
- [ ] API svarar när jag testar med curl

**Supabase:**
- [ ] Rätt Supabase-projekt öppnat
- [ ] Kollat customers-tabellen
- [ ] Kollat offers-tabellen
- [ ] Kollat documents-tabellen
- [ ] Miljövariabler är korrekta

**Vercel:**
- [ ] Senaste deployment lyckades
- [ ] Environment variables finns
- [ ] Loggar visar API-anrop (eller inga loggar om inte anropat)

---

## 🚨 Om Ingenting Fungerar

### Kör Fullständig Test:

```bash
# 1. Starta lokal server
npm run dev

# 2. I ny terminal, testa API:
curl -X POST http://localhost:3000/api/offers/create-from-gpt \
  -H "Content-Type: application/json" \
  -d @test-gpt-data.json

# 3. Kolla Supabase direkt efter
# 4. Om det fungerar lokalt → Problem är i GPT Action
# 5. Om det inte fungerar lokalt → Problem är i backend
```

---

## 📞 Nästa Steg

**Rapportera tillbaka:**

1. **Vad visade GPT efter offerten skapades?**
   - Kund-ID?
   - PDF-URL?
   - Felmeddelande?
   - Bara text?

2. **Vad ser du i backend-loggar?**
   - (Kopiera loggar här)

3. **Vad ser du i Supabase?**
   - Tom tabell?
   - Gammal data?
   - Fel tabell?

**Då kan jag hjälpa dig exakt var problemet är!** 🎯
