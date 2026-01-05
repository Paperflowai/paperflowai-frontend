# Debug-guide för autofyll-problem

Du rapporterade att följande fält saknas:
- ❌ Kundnummer
- ❌ Postnummer
- ❌ Ort
- ❌ Befattning
- ❌ Datum

## Steg 1: Kolla vad GPT:en faktiskt skickar

### I din anpassade GPT:
1. Skapa en testoffert
2. Kopiera **exakt** vad GPT:en säger att den skickar till API:et
3. Leta efter ett JSON-block i GPT:ens svar

**Exempel på vad du ska se:**
```json
{
  "customerId": null,
  "jsonData": {
    "kund": {
      "namn": "Test AB",
      "postnummer": "123 45",
      "ort": "Stockholm",
      "befattning": "VD"
    },
    "offert": {
      "offertnummer": "OFF-2026-0001",
      "datum": "2026-01-02"
    }
  },
  "textData": "..."
}
```

**Kolla:**
- ✅ Finns `jsonData.kund.postnummer`?
- ✅ Finns `jsonData.kund.ort`?
- ✅ Finns `jsonData.kund.befattning`?
- ✅ Finns `jsonData.offert.offertnummer`?
- ✅ Finns `jsonData.offert.datum`?

---

## Steg 2: Kolla backend-loggar

### Lokal testning (npm run dev):
1. Öppna terminalen där du kör `npm run dev`
2. Skapa en testoffert med GPT
3. Kolla loggarna

**Vad du ska se:**
```
[create-from-gpt] 📦 Raw jsonData: { ... }
[create-from-gpt] 👤 kund-object: { namn: "Test AB", postnummer: "123 45", ... }
[create-from-gpt] 🏢 Resultat companyName: Test AB
[create-from-gpt] 📊 Extraherade värden:
  companyName: Test AB
  orgNr: 556677-8899
  contactPerson: Anna Andersson
  role: VD
  email: anna@test.se
  phone: 070-123 45 67
  address: Testgatan 1
  zip: 123 45
  city: Stockholm
  country: Sverige
  customerNumber: OFF-2026-0001
  contactDate: 2026-01-02
[create-from-gpt] ✅ Customer data saved
```

**Kolla:**
- ✅ Är `zip: 123 45` korrekt?
- ✅ Är `city: Stockholm` korrekt?
- ✅ Är `role: VD` korrekt?
- ✅ Är `customerNumber: OFF-2026-0001` korrekt?
- ✅ Är `contactDate: 2026-01-02` korrekt?

Om alla värden är `null` betyder det att GPT:en inte skickar rätt struktur.

### Production (Vercel):
1. Gå till Vercel Dashboard
2. Välj ditt projekt
3. Gå till "Logs"
4. Filtrera på `[create-from-gpt]`

---

## Steg 3: Kolla databasen direkt

### I Supabase:
1. Gå till Supabase Dashboard
2. Öppna "Table Editor"
3. Välj tabellen `customers`
4. Sök efter "Test AB"
5. Kolla fälten:
   - `role` - ska vara "VD"
   - `zip` - ska vara "123 45"
   - `city` - ska vara "Stockholm"
   - `customer_number` - ska vara "OFF-2026-0001"
   - `contact_date` - ska vara "2026-01-02"

**Om fälten är NULL i databasen:**
→ Backend tar inte emot rätt data från GPT

**Om fälten är IFYLLDA i databasen men saknas på plattformen:**
→ Frontend läser inte fälten korrekt

---

## Vanliga problem och lösningar

### Problem 1: GPT skickar fel struktur
**Symptom:** Backend-loggarna visar `null` för alla fält

**Lösning:**
1. Kolla att OpenAPI-schemat är korrekt importerat
2. Verifiera att GPT:en använder senaste version av schemat
3. Testa att re-importera schemat

### Problem 2: Datum hamnar som företagsnamn
**Symptom:** `companyName: "2026-01-02"` istället för "Test AB"

**Lösning:** Redan fixat med `looksLikeDate()` och `cleanText()`

### Problem 3: Fält finns i databas men inte på plattformen
**Symptom:** Supabase visar data men plattformen visar tom

**Lösning:** Frontend cachar gammal data
1. Öppna DevTools (F12)
2. Application → Clear storage
3. Ladda om sidan

### Problem 4: GPT genererar inte `offert`-objektet
**Symptom:** `customerNumber: null` och `contactDate: null`

**Kontrollera:**
```json
{
  "jsonData": {
    "offert": {  // ← Finns detta?
      "offertnummer": "OFF-2026-0001",
      "datum": "2026-01-02"
    }
  }
}
```

Om `offert`-objektet saknas, skicka dessa fält direkt under `jsonData` istället.

---

## Test-kommando

Kör detta för att testa API:et direkt (utan GPT):

```powershell
.\test-gpt-api.ps1
```

Detta skickar exakt rätt format till API:et och visar vilka fält som fylls i.

**Förväntad output:**
```
✅ Företagsnamn: Test AB
✅ Org.nr: 556677-8899
✅ Kontaktperson: Anna Andersson
✅ Befattning: VD
✅ E-post: anna@test.se
✅ Telefon: 070-123 45 67
✅ Adress: Testgatan 1
✅ Postnummer: 123 45
✅ Ort: Stockholm
✅ Land: Sverige
✅ Kundnummer: OFF-2026-0001
✅ Datum: 2026-01-02
```

Om test-skriptet fungerar men GPT:en inte gör det → GPT skickar fel format.

---

## Nästa steg

1. **Kör test-skriptet först:** `.\test-gpt-api.ps1`
2. **Om testet lyckas:** Problemet är i GPT:ens format
3. **Om testet misslyckas:** Problemet är i backend

Rapportera tillbaka vad du ser i:
- Backend-loggar (`npm run dev`)
- Test-skript output
- Vad GPT:en faktiskt skickar
