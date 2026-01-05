# Autofyll - Var Styr Vad?

## 📍 Översikt

Autofyll av kunddata hanteras i **3 huvudsakliga filer**:

---

## 1️⃣ Kundkort (Visa & Redigera Kund)

### Fil: `src/app/kund/[id]/page.tsx`

**Rad 310-432:** Funktion `loadCustomerData()`

**Vad den gör:**
- Läser kunddata från Supabase
- Fyller i formuläret automatiskt
- Hanterar fallbacks (name → company_name)

**Autofyll-logik (rad 327-380):**
```typescript
// Företagsnamn – ta helst name, annars company_name
companyName:
  cleanText(customerRow.name) ??
  cleanText(customerRow.company_name) ??
  prev.companyName,

// Org.nr
orgNr:
  cleanText(customerRow.org_nr) ??
  cleanText(customerRow.orgnr) ??
  prev.orgNr,

// Kontaktperson
contactPerson:
  cleanText(customerRow.contact_person) ??
  prev.contactPerson,

// ... och så vidare för alla fält
```

**Viktigt:**
- ✅ Läser från BÅDA `name` OCH `company_name`
- ✅ Använder `cleanText()` för att filtrera datum
- ✅ Fallback till tidigare värde om null

---

## 2️⃣ Kundregister (Dashboard)

### Fil: `src/app/dashboard/page.tsx`

**Rad 572-612:** Funktion `laddaKunder()`

**Vad den gör:**
- Hämtar alla kunder från Supabase
- Visar i tabellen på dashboard
- Filtrerar bort demo-kunder

**Autofyll-logik (rad 587):**
```typescript
const dbCustomers: Kund[] = (data || []).map((row: any) => ({
  id: String(row.id),
  companyName: (row.name || '').trim(), // ⚠️ LÄSER BARA 'name'
  orgNr: row.orgnr || '',
  contactPerson: '',
  // ...
}));
```

**Problem:**
- ❌ **LÄSER INTE `company_name`** (bara `name`)
- ❌ Detta är varför "OKÄNT FÖRETAG" visas i listan
- ✅ Detta fixades i min tidigare patch (men återställdes)

**Fix:**
```typescript
// FÖRE:
companyName: (row.name || '').trim(),

// EFTER (borde vara):
companyName: (row.name || row.company_name || '').trim(),
```

---

## 3️⃣ LocalStorage Cache

### Fil: `src/lib/customerStore.ts`

**Rad 28-60:** Funktion `upsertCustomerWithOffer()`

**Vad den gör:**
- Sparar kunddata i localStorage
- Används för offline-caching
- Matchar kunder på org.nr eller e-post

**Autofyll-logik:**
```typescript
// Uppdatera befintlig kund
customers[idx] = {
  ...existing,
  ...customerData, // ← Nya värden skriver över gamla
  offers: already ? offers : [...offers, offer],
};
```

**Viktigt:**
- ✅ Sammanfogar data från olika källor
- ✅ Behåller befintliga offerter
- ⚠️ Kan ha gamla, cachade värden

---

## 🔄 Dataflöde

### När GPT Skapar Offert:

```
1. GPT → POST /api/offers/create-from-gpt
   ↓
2. Backend sparar i Supabase:
   - name: "Company AB"
   - company_name: "Company AB"
   ↓
3. Backend returnerar customerData:
   - companyName: "Company AB"
   ↓
4. Frontend (om används):
   - Sparar i localStorage (customerStore.ts)
   - Visar i dashboard (dashboard/page.tsx)
   - Visar på kundkort (kund/[id]/page.tsx)
```

### När Du Öppnar Kundkort:

```
1. Öppna /kund/[id]
   ↓
2. loadCustomerData() körs (rad 310)
   ↓
3. Läser från Supabase:
   SELECT name, company_name, orgnr, email, ...
   ↓
4. Autofyll i formulär:
   companyName = name ?? company_name ?? ""
   ↓
5. Formulär ifyllt ✅
```

### När Du Öppnar Dashboard:

```
1. Öppna /dashboard
   ↓
2. laddaKunder() körs (rad 572)
   ↓
3. Läser från Supabase:
   SELECT name, orgnr, email, ... (⚠️ INTE company_name)
   ↓
4. Mappar till Kund[]:
   companyName = name (⚠️ MISSAR company_name)
   ↓
5. Visas i tabell:
   - Om name finns → OK ✅
   - Om bara company_name finns → "Namnlös kund" ❌
```

---

## 🐛 Nuvarande Problem

### Problem 1: Dashboard Läser Inte `company_name`

**Fil:** `src/app/dashboard/page.tsx:587`

**Nuvarande kod:**
```typescript
companyName: (row.name || '').trim(),
```

**Borde vara:**
```typescript
companyName: (row.name || row.company_name || '').trim(),
```

**Symptom:**
- Dashboard visar "Namnlös kund"
- Även om `company_name` finns i databasen

**Fix:** Lägg till `company_name` i SELECT och mapping

---

### Problem 2: LocalStorage Cache Kan Vara Gammal

**Fil:** `src/lib/customerStore.ts`

**Problem:**
- Gamla värden finns kvar i localStorage
- Även efter databas-uppdateringar

**Symptom:**
- Kundkort visar gamla värden
- Dashboard visar nya värden

**Fix:**
```javascript
// I DevTools Console:
localStorage.clear()
location.reload()
```

---

## ✅ Lösningar

### Snabbfix 1: Dashboard (VIKTIGAST)

**Ändra rad 577 i `src/app/dashboard/page.tsx`:**

```typescript
// FÖRE:
.select('id, name, orgnr, email, phone, address, zip, city, country');

// EFTER:
.select('id, name, company_name, orgnr, email, phone, address, zip, city, country');
```

**Ändra rad 587:**
```typescript
// FÖRE:
companyName: (row.name || '').trim(),

// EFTER:
companyName: (row.name || row.company_name || '').trim(),
```

---

### Snabbfix 2: Rensa Cache

**För att se nya värden direkt:**

1. Öppna DevTools (F12)
2. Console tab
3. Kör:
   ```javascript
   localStorage.clear()
   location.reload()
   ```

---

## 📊 Sammanfattning

| Fil | Ansvar | Läser company_name? | Problem? |
|-----|--------|---------------------|----------|
| `kund/[id]/page.tsx` | Kundkort | ✅ Ja | ✅ Fungerar |
| `dashboard/page.tsx` | Kundlista | ❌ Nej | ❌ PROBLEM |
| `lib/customerStore.ts` | Cache | ⚠️ Beror på | ⚠️ Gammal data |

---

## 🎯 Exakt Var Du Ska Ändra

### Fil 1: `src/app/dashboard/page.tsx`

**Hitta rad 577:**
```typescript
.select('id, name, orgnr, email, phone, address, zip, city, country');
```

**Ändra till:**
```typescript
.select('id, name, company_name, orgnr, email, phone, address, zip, city, country');
```

**Hitta rad 587:**
```typescript
companyName: (row.name || '').trim(),
```

**Ändra till:**
```typescript
companyName: (row.name || row.company_name || '').trim(),
```

---

**Det är dessa 2 rader som styr om företagsnamn visas korrekt i kundregistret!** 🎯
