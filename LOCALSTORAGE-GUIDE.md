# Guide: Kolla localStorage för Gammal Data

## 🎯 Vad Är localStorage?

localStorage är webbläsarens inbyggda cache där data sparas lokalt på din dator.

**I ditt system används det för:**
- Spara kunddata offline
- Snabbare laddning (behöver inte alltid hämta från Supabase)
- Backup om internet försvinner

**Men:**
- ⚠️ Kan innehålla **gammal data** från innan dina fixar
- ⚠️ Synkas inte automatiskt med Supabase
- ⚠️ Kan visa "OKÄNT FÖRETAG" även om databasen har rätt namn

---

## 🔍 Metod 1: Kolla i DevTools Console (Snabbast)

### Steg 1: Öppna DevTools
```
Tryck F12 (Windows)
eller
Cmd+Option+I (Mac)
```

### Steg 2: Gå till Console-fliken

### Steg 3: Klistra in detta:
```javascript
// Hämta cached kunddata
const customers = JSON.parse(localStorage.getItem('paperflow_customers_v1') || '[]');

// Visa i tabell
console.table(customers.map(c => ({
  Företag: c.companyName || 'SAKNAS',
  Email: c.email || 'SAKNAS',
  'Org.nr': c.orgNr || 'SAKNAS',
  ID: c.id
})));

// Kolla efter problem
const placeholders = customers.filter(c =>
  ['OKÄNT FÖRETAG', 'Ny kund', 'Namnlös kund'].includes(c.companyName)
);

console.log(`\n📊 Resultat:`);
console.log(`Totalt i cache: ${customers.length}`);
console.log(`Med placeholder-namn: ${placeholders.length}`);

if (placeholders.length > 0) {
  console.warn('⚠️ GAMMAL DATA HITTAD!');
  console.log('Rensa cache med: localStorage.clear(); location.reload()');
} else {
  console.log('✅ Cache ser bra ut!');
}
```

### Vad Du Ser:

**Om cache är OK:**
```
📊 Resultat:
Totalt i cache: 5
Med placeholder-namn: 0
✅ Cache ser bra ut!
```

**Om cache har problem:**
```
📊 Resultat:
Totalt i cache: 5
Med placeholder-namn: 3
⚠️ GAMMAL DATA HITTAD!
Rensa cache med: localStorage.clear(); location.reload()
```

---

## 🔍 Metod 2: Använd HTML-verktyget (Enklast)

### Steg 1: Öppna filen
```
Högerklicka på: check-localStorage.html
→ Välj "Open with Live Server" (VS Code)
eller
→ Dubbelklicka (öppnas i webbläsare)
```

### Steg 2: Klicka på knapparna

**🔍 Kolla localStorage** - Visar vad som finns i cache
**⚖️ Jämför med Supabase** - Jämför cache med databas
**🗑️ Rensa Cache** - Tar bort gammal data

### Vad Du Ser:

**Bra (Grön):**
```
✅ All kunddata i cache ser bra ut!
```

**Problem (Gul):**
```
⚠️ Hittade 3 kund(er) med placeholder-namn.
Överväg att rensa cache.
```

---

## 🔍 Metod 3: Kör Node.js Script (Mest Detaljerad)

```bash
# Lägg in scriptet i DevTools Console
# Öppna http://localhost:3000 först
# Klistra in innehållet från check-localStorage.js
```

---

## 🐛 Vanliga Problem

### Problem 1: "OKÄNT FÖRETAG" i cache

**Symptom:**
```
⚠️ Found 3 customers with placeholder names
```

**Orsak:**
- Gammal data från innan automatisk uppdatering

**Lösning:**
```javascript
localStorage.clear()
location.reload()
```

---

### Problem 2: Cache och Databas matchar inte

**Symptom:**
```
⚠️ Found 2 difference(s):
localStorage: "OKÄNT FÖRETAG"
Supabase: "Acme AB"
```

**Orsak:**
- Databasen uppdaterades men cache inte

**Lösning:**
```javascript
localStorage.clear()
location.reload()
```

---

### Problem 3: Dubbletter i cache

**Symptom:**
```
Totalt i cache: 10
men du har bara 5 kunder i Supabase
```

**Orsak:**
- Gamla test-kunder
- Raderade kunder finns kvar i cache

**Lösning:**
```javascript
localStorage.clear()
location.reload()
```

---

## 🧹 Rensa Cache (Manuellt)

### Alternativ 1: DevTools Console
```javascript
localStorage.clear()
location.reload()
```

### Alternativ 2: DevTools Application Tab
```
1. F12 → Application tab
2. Storage → localStorage → localhost:3000
3. Högerklicka → Clear
4. Refresh (F5)
```

### Alternativ 3: HTML-verktyget
```
1. Öppna check-localStorage.html
2. Klicka "🗑️ Rensa Cache"
```

---

## ✅ Hur Cache Ska Se Ut

**Bra cache:**
```json
[
  {
    "id": "123",
    "companyName": "Acme AB",
    "email": "info@acme.se",
    "orgNr": "556677-8899",
    "offers": [...]
  },
  {
    "id": "456",
    "companyName": "Test Company Ltd",
    "email": "test@company.com",
    "orgNr": "123456-7890",
    "offers": [...]
  }
]
```

**Dålig cache (rensa!):**
```json
[
  {
    "id": "123",
    "companyName": "OKÄNT FÖRETAG",  // ← PROBLEM!
    "email": "info@acme.se",
    "orgNr": "556677-8899"
  },
  {
    "companyName": "Ny kund",  // ← PROBLEM!
    "email": null
  }
]
```

---

## 🔄 När Cache Uppdateras

Cache uppdateras ENDAST när:
1. ✅ Du skapar ny offert via GPT
2. ✅ Du sparar kunddata manuellt
3. ❌ **INTE** när Supabase uppdateras direkt

**Detta betyder:**
- Om du fixar data i Supabase direkt → cache behöver rensas
- Om GPT auto-uppdaterar → cache kanske inte uppdateras
- Säkrast: Rensa cache efter stora ändringar

---

## 📊 Checklistaе

Innan du rensar cache, kolla:

- [ ] Har du osparade ändringar i formulär? (Spara först!)
- [ ] Är du säker på att Supabase har rätt data?
- [ ] Har du backup om något går fel?

Efter du rensat cache:

- [ ] Reload sidan (F5)
- [ ] Logga in igen om nödvändigt
- [ ] Verifiera att data ser rätt ut
- [ ] Kolla att offerter fortfarande finns

---

## 💡 Tips

### Förhindra Gamla Data

1. **Efter varje GPT-fix:**
   ```javascript
   localStorage.clear()
   location.reload()
   ```

2. **Före viktiga demos:**
   ```javascript
   localStorage.clear()
   location.reload()
   ```

3. **Om du ser konstigt beteende:**
   ```javascript
   localStorage.clear()
   location.reload()
   ```

### Debug Cache-Problem

```javascript
// Se RAW data
console.log(localStorage.getItem('paperflow_customers_v1'));

// Se parsed data
console.log(JSON.parse(localStorage.getItem('paperflow_customers_v1') || '[]'));

// Se alla localStorage keys
console.log(Object.keys(localStorage));

// Se total storlek
let total = 0;
Object.keys(localStorage).forEach(key => {
  total += localStorage.getItem(key).length;
});
console.log(`Total cache size: ${(total / 1024).toFixed(2)} KB`);
```

---

## 🎯 Sammanfattning

| Metod | Svårighetsgrad | Tid |
|-------|----------------|-----|
| DevTools Console | ⭐⭐ | 1 min |
| HTML-verktyg | ⭐ | 30 sek |
| Node.js script | ⭐⭐⭐ | 2 min |
| Manual inspection | ⭐⭐⭐⭐ | 5 min |

**Rekommendation:**
1. Börja med HTML-verktyget (enklast)
2. Om problem → Rensa cache
3. Om fortfarande problem → Kolla Supabase direkt

---

**Kör HTML-verktyget nu för att se om du har gammal data!** 🔍
