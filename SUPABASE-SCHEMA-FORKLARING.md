# Varför BÅDE `name` OCH `company_name`?

## ✅ JA, Det Är Rätt!

Du har BÅDE `name` och `company_name` kolumner av **bra skäl**:

---

## 🔄 Bakåtkompatibilitet

### Tidigare:
- Endast `name` kolumn användes
- All gammal kod läser från `name`

### Nu:
- **BÅDA** kolumnerna finns
- Ny kod kan använda `company_name` (tydligare namn)
- Gammal kod fungerar fortfarande (läser `name`)

### Backend Sparar Till BÅDA:
```typescript
// src/app/api/offers/create-from-gpt/route.ts rad 228-229
const customerRow = {
  name: companyName,          // ← BÅDA
  company_name: companyName,  // ← BÅDA
  // ...
}
```

**Varför?**
- ✅ Garanterar att ALLT fungerar
- ✅ Inget går sönder
- ✅ Smidig övergång

---

## 🐛 Ditt Problem: "Ny kund" Överallt

### Vad Du Ser I Supabase:
```
| id  | name     | company_name | email | phone | address |
|-----|----------|--------------|-------|-------|---------|
| 123 | Ny kund  | NULL         | NULL  | NULL  | NULL    |
```

### Vad Som Hände:

1. **GPT skapade offert**
2. **GPT skickade:**
   ```json
   {
     "jsonData": {
       "kund": {
         "namn": null  // ← MISSADE företagsnamnet!
       }
     },
     "textData": "# OFFERT\n\nKund: Acme AB\n..."
   }
   ```

3. **Backend körde `getCompanyName()`:**
   ```typescript
   // Alla dessa fält är null/undefined:
   kund.namn = null
   kund.name = null
   kund.företag = null

   // Fallback används:
   return "Ny kund"
   ```

4. **Backend sparade:**
   ```typescript
   name: "Ny kund",          // ← Fallback
   company_name: "Ny kund",  // ← Fallback
   ```

5. **Auto-extraction körde:**
   ```typescript
   // Kollade textData för företagsnamn
   // HITTADE INTE (eller försökte men misslyckades)
   // Lämnade "Ny kund" kvar
   ```

---

## ❓ Varför Misslyckades Auto-Extraction?

### Möjliga Orsaker:

#### 1. Text saknar tydligt mönster
```
# Dåligt (svårt att extrahera):
Hej! Jag vill ha en offert.
Bästa hälsningar,
Anders från Acme

# Bra (lätt att extrahera):
Kund: Acme AB
Företag: Acme AB
```

#### 2. Företagsnamn ser ut som datum
```typescript
// Auto-extraction filtrerar bort datum:
if (looksLikeDate(line)) {
  return null; // Skippa denna rad
}
```

#### 3. Företagsnamn saknar "AB/Ltd/Inc"
```typescript
// Söker efter:
if (/\b(AB|HB|KB|Ltd|Inc|LLC|AS)\b/i.test(line)) {
  // Troligen ett företagsnamn
}
```

**Om företagsnamnet är bara "Acme" (utan AB):**
- Kanske inte hittas
- Kanske förväxlas med annat

---

## 🔍 Kolla Vad Som Skickades

### Öppna Backend-Loggar:

```bash
npm run dev
```

### Skapa en TESTOFFERT via GPT:

```
"Skapa offert för TestCompany AB"
```

### Leta efter dessa loggar:

```
[create-from-gpt] 📦 Raw jsonData: { ... }
[create-from-gpt] 👤 kund-object: { namn: "???" }  ← Vad står här?
[create-from-gpt] 🏢 Resultat companyName: ???     ← Och här?
[create-from-gpt] 🔍 Company name is placeholder...  ← Kördes auto-extraction?
[create-from-gpt] ✨ Found company name in text: "TestCompany AB"
[create-from-gpt] ✅ Company name auto-updated successfully
```

---

## ✅ Vad Som SKA Hända

### Rätt Flöde:

```
1. GPT skapar offert
   ↓
2. GPT skickar företagsnamn i jsonData.kund.namn
   ↓
3. Backend: companyName = "Acme AB"
   ↓
4. Sparar till databas:
   name: "Acme AB"
   company_name: "Acme AB"
   ✅ KLART
```

### Backup Flöde (Auto-Extraction):

```
1. GPT skapar offert
   ↓
2. GPT MISSAR företagsnamn (namn = null)
   ↓
3. Backend: companyName = "Ny kund" (fallback)
   ↓
4. Sparar till databas:
   name: "Ny kund"
   company_name: "Ny kund"
   ↓
5. ✨ Auto-extraction körs:
   - Läser textData
   - Hittar "Kund: Acme AB"
   - Uppdaterar databas:
     name: "Acme AB"
     company_name: "Acme AB"
   ✅ FIXAT
```

### Ditt Fall (Misslyckades):

```
1. GPT skapar offert
   ↓
2. GPT MISSAR företagsnamn
   ↓
3. Backend: companyName = "Ny kund"
   ↓
4. Sparar till databas:
   name: "Ny kund"
   company_name: "Ny kund"
   ↓
5. ✨ Auto-extraction körs:
   - Läser textData
   - ❌ HITTAR INTE företagsnamn
   - Lämnar "Ny kund" kvar
   ❌ PROBLEM KVARSTÅR
```

---

## 🎯 Vad Du Ska Göra NU

### 1. Testa Med En Ny Offert

Skapa en testoffert via GPT med **TYDLIGT** format:

```
"Skapa en offert för TestCompany AB

Kund: TestCompany AB
Org.nr: 123456-7890
Kontaktperson: Anna Andersson
E-post: anna@test.se
Telefon: 070-123 45 67

Tjänst: Testning av autofyll
Pris: 1000 kr"
```

### 2. Kolla Backend-Loggar

```bash
npm run dev
# Skapa offert
# Se vad som loggas
```

### 3. Kolla Supabase

```sql
SELECT id, name, company_name, email, created_at
FROM customers
ORDER BY created_at DESC
LIMIT 5;
```

**Förväntat resultat:**
```
name: "TestCompany AB"
company_name: "TestCompany AB"
email: "anna@test.se"
```

---

## 🔧 Om Auto-Extraction Inte Funkar

### Problemet:

Auto-extraction körde men hittade inte företagsnamnet i texten.

### Lösning 1: Förbättra Extraction-Logik

Lägg till fler mönster i `create-from-gpt/route.ts` rad 287-304:

```typescript
// Nuvarande mönster:
- "Kund: Company AB"
- "Företag: Company AB"
- Rad med "AB/Ltd/Inc"

// Kan lägga till:
- "För: Company AB"
- "Customer: Company AB"
- Första raden som inte är "OFFERT" eller "Datum"
```

### Lösning 2: GPT Schema

Säkerställ att GPT **ALLTID** skickar företagsnamn:

```json
{
  "jsonData": {
    "kund": {
      "namn": "Company AB"  // ← OBLIGATORISKT
    }
  }
}
```

---

## 📊 Sammanfattning

| Fråga | Svar |
|-------|------|
| **Är det rätt med BÅDA kolumnerna?** | ✅ JA - bakåtkompatibilitet |
| **Varför står det "Ny kund"?** | ❌ GPT missade namn + auto-extraction misslyckades |
| **Varför autofylls inte alla fält?** | ❌ GPT skickar null för många fält |
| **Hur fixar jag?** | Testa med tydligare format, kolla loggar |

---

**Testa att skapa en ny offert med tydligt format och kolla loggarna! Sedan kan vi felsöka vidare.** 🔍
