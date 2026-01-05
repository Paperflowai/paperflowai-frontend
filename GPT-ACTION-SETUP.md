# Konfigurera Anpassad GPT med Actions

Denna guide visar hur du konfigurerar din anpassade offert-GPT för att automatiskt skicka offerter till plattformen.

## Översikt

När din anpassade GPT skapar en offert ska den:
1. Generera offertdata i JSON-format
2. Anropa plattformens API via Actions
3. Plattformen skapar automatiskt ny kund och offert
4. Kunddata autofylls i formuläret

---

## Steg 1: Skapa/Redigera din anpassade GPT

1. Gå till [ChatGPT - My GPTs](https://chat.openai.com/gpts/editor)
2. Klicka på din befintliga offert-GPT eller skapa en ny
3. Gå till fliken **"Configure"**

---

## Steg 2: Lägg till Action

### 2.1 Aktivera Actions
1. Scrolla ner till **"Actions"**-sektionen
2. Klicka på **"Create new action"**

### 2.2 Importera Schema
Kopiera innehållet från `gpt-action-schema.json` och klistra in i **"Schema"**-fältet.

**VIKTIGT:** Byt ut `https://yourapp.com` i schemat till din faktiska URL:
- **Production**: `https://din-app-domän.com`
- **Development**: `http://localhost:3000`

### 2.3 Ge Action ett namn
- **Action name**: `createOfferFromGPT`

---

## Steg 3: Konfigurera Authentication (valfritt)

### Utan autentisering (enklast för start)
1. Välj **"None"** under Authentication
2. ⚠️ **OBS**: Detta gör endpointen öppen. Lägg till autentisering i produktion.

### Med API-nyckel (rekommenderat för produktion)
1. Välj **"API Key"**
2. Ange API-nyckel från plattformen
3. Uppdatera API-endpointen för att validera API-nyckeln

---

## Steg 4: Uppdatera GPT Instructions

Lägg till följande i din GPT:s **"Instructions"**:

```
När användaren ber dig skapa en offert:

1. Samla in kundinformation:
   - Företagsnamn
   - Organisationsnummer
   - Kontaktperson (namn, e-post, telefon, befattning)
   - Adress (gatuadress, postnummer, ort, land)

2. Generera offertinnehåll:
   - Titel
   - Datum (dagens datum i formatet YYYY-MM-DD)
   - Offertnummer (format: OFF-YYYY-XXXX, t.ex. OFF-2026-0001)
   - Tjänster/produkter med priser
   - Totalsumma (exkl. moms)

3. Skapa JSON-struktur:
{
  "offertnummer": "OFF-2026-0001",
  "datum": "2026-01-02",
  "titel": "Offert för...",
  "summa": 118000,
  "valuta": "SEK",
  "kund": {
    "namn": "Företagsnamn",
    "orgnr": "XXXXXX-XXXX",
    "kontaktperson": "Anna Andersson",
    "epost": "anna@exempel.se",
    "telefon": "070-123 45 67",
    "adress": "Gatuadress",
    "postnummer": "XXX XX",
    "ort": "Stad",
    "land": "Sverige",
    "befattning": "VD"
  }
}

4. Skapa offerttext i markdown-format

5. Anropa createOfferFromGPT Action med:
   - customerId: null (skapar alltid ny kund)
   - jsonData: JSON-strukturen ovan
   - textData: Den fullständiga offerttexten

6. Bekräfta för användaren att offerten har skapats och sparats.
```

---

## Steg 5: Testa din GPT Action

### Testfall i ChatGPT

Skriv till din GPT:

```
Skapa en offert för Exempel AB med följande information:

Företag: Exempel AB
Org.nr: 556677-8899
Kontaktperson: Anna Andersson, VD
E-post: anna@exempel.se
Telefon: 070-123 45 67
Adress: Exempelgatan 1, 123 45 Stockholm

Tjänster:
- Webbutveckling: 80 timmar à 1200 kr
- SEO-optimering: 10 timmar à 1000 kr
```

### Förväntat resultat

GPT ska:
1. ✅ Generera en komplett offert
2. ✅ Anropa API:et automatiskt
3. ✅ Visa bekräftelse: "Offerten har skapats och sparats till plattformen"
4. ✅ Visa kund-ID och PDF-URL

---

## Steg 6: Verifiera på plattformen

1. Öppna plattformen
2. Gå till **Dashboard** → **Kunder**
3. Du ska se en ny kund: "Exempel AB"
4. Öppna kundkortet
5. Alla fält ska vara autofyllda:
   - Företagsnamn: Exempel AB
   - Org.nr: 556677-8899
   - Kontaktperson: Anna Andersson
   - etc.
6. Offerten ska synas i **OfferPanel**

---

## Felsökning

### Action anropas inte
- Kontrollera att schema är korrekt importerat
- Kolla att URL:en i schema matchar din plattform
- Verifiera att GPT:s instructions säger att den ska anropa Action

### "Missing textData" error
- GPT glömde skicka `textData`-fältet
- Uppdatera GPT instructions för att alltid inkludera fullständig offerttext

### Kunddata visas inte på plattformen
- Kontrollera att API-svaret innehåller `customerData`
- Kolla backend-loggar: `console.log("[create-from-gpt] ...")`
- Verifiera att JSON-strukturen matchar förväntad format

### Datum hamnar som företagsnamn
- Detta är redan fixat i `src/app/api/offers/create-from-gpt/route.ts` (rad 14-44)
- `looksLikeDate()` och `cleanText()` filtrerar bort datum automatiskt

---

## JSON-struktur från GPT

Din GPT ska generera JSON i detta format:

```json
{
  "customerId": null,
  "jsonData": {
    "offertnummer": "OFF-2026-0001",
    "datum": "2026-01-02",
    "titel": "Offert för webbutveckling",
    "summa": 118000,
    "valuta": "SEK",
    "kund": {
      "namn": "Företagsnamn AB",
      "orgnr": "556677-8899",
      "kontaktperson": "Kontaktperson Namn",
      "epost": "kontakt@foretag.se",
      "telefon": "070-123 45 67",
      "adress": "Gatuadress 1",
      "postnummer": "123 45",
      "ort": "Stockholm",
      "land": "Sverige",
      "befattning": "VD"
    }
  },
  "textData": "# OFFERT\n\nKund: Företagsnamn AB\nDatum: 2026-01-02\n..."
}
```

---

## API Endpoint

**URL**: `POST /api/offers/create-from-gpt`

**Request Body**:
```json
{
  "customerId": null,
  "jsonData": { ... },
  "textData": "..."
}
```

**Response (Success - 200)**:
```json
{
  "ok": true,
  "customerId": "uuid-here",
  "documentId": "doc-id",
  "offerId": "offer-id",
  "pdfUrl": "https://...",
  "customerData": {
    "companyName": "Företagsnamn AB",
    "orgNr": "556677-8899",
    ...
  }
}
```

---

## Säkerhet

### Produktion
- Använd HTTPS
- Lägg till API-nyckelautentisering
- Validera request headers
- Rate-limiting för API-anrop

### Development
- Testa med `localhost:3000`
- Använd ngrok för att exponera lokalt API till GPT

---

## Nästa steg

1. ✅ Konfigurera GPT Action enligt denna guide
2. ✅ Testa med ett exempel
3. ✅ Verifiera autofyll på plattformen
4. 🔒 Lägg till autentisering för produktion
5. 🚀 Deploya till produktion

---

## Support

Om något inte fungerar:
- Kolla backend-loggar: `npm run dev` och se console.log
- Verifiera JSON-format från GPT
- Testa API-endpointen direkt med curl/Postman
