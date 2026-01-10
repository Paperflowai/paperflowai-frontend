# SNABB-CHECK: Kolla localStorage NU

## 📋 Kopiera & Klistra (Komplett)

### 1. Öppna Console
```
Tryck F12 → Console-fliken
```

### 2. Klistra in ALLT detta (kopiera hela blocket):

```javascript
// ===================================================
// KOLLA LOCALSTORAGE FÖR GAMMAL DATA
// ===================================================

console.clear();
console.log('='.repeat(60));
console.log('🔍 Checking localStorage...');
console.log('='.repeat(60));

const customers = JSON.parse(localStorage.getItem('paperflow_customers_v1') || '[]');

if (customers.length === 0) {
  console.log('ℹ️  Tom cache - ingen data hittades');
  console.log('   Detta är OK - data laddas från Supabase');
} else {
  console.log(`\n📊 Hittade ${customers.length} kund(er) i cache:\n`);

  // Visa tabell
  console.table(customers.map((c, i) => ({
    '#': i + 1,
    'Företag': c.companyName || 'SAKNAS',
    'Email': c.email || 'SAKNAS',
    'Org.nr': c.orgNr || 'SAKNAS'
  })));

  // Kolla problem
  const placeholders = customers.filter(c =>
    ['OKÄNT FÖRETAG', 'Ny kund', 'Namnlös kund'].includes(c.companyName)
  );

  const noName = customers.filter(c => !c.companyName || c.companyName.trim() === '');

  console.log('\n📊 RESULTAT:');
  console.log(`   Totalt kunder: ${customers.length}`);
  console.log(`   Med placeholder-namn: ${placeholders.length}`);
  console.log(`   Utan namn: ${noName.length}`);

  if (placeholders.length > 0) {
    console.log('\n⚠️  GAMMAL DATA HITTAD!');
    console.log('   Följande kunder har placeholder-namn:');
    placeholders.forEach((c, i) => {
      console.log(`   ${i + 1}. "${c.companyName}" (ID: ${c.id})`);
    });
    console.log('\n💡 LÖSNING:');
    console.log('   Kopiera och kör detta:');
    console.log('   %clocalStorage.clear(); location.reload();', 'background: #f44336; color: white; padding: 5px; font-weight: bold;');
  } else if (noName.length > 0) {
    console.log('\n⚠️  Kunder utan namn hittade');
    console.log('   Överväg att rensa cache');
  } else {
    console.log('\n✅ ALLT SER BRA UT!');
    console.log('   Alla kunder har riktiga företagsnamn');
  }
}

console.log('\n' + '='.repeat(60));
```

### 3. Tryck Enter

### 4. Läs Resultatet

**Om du ser:**
```
✅ ALLT SER BRA UT!
```
→ **Du är klar!** Ingen gammal data.

**Om du ser:**
```
⚠️ GAMMAL DATA HITTAD!
```
→ **Kopiera och kör detta:**
```javascript
localStorage.clear(); location.reload();
```

**Om du ser:**
```
ℹ️ Tom cache - ingen data hittades
```
→ **Detta är OK!** Data laddas direkt från Supabase.

---

## 🎯 Sammanfattning

| Resultat | Vad Det Betyder | Åtgärd |
|----------|-----------------|--------|
| ✅ Allt ser bra ut | Cache är OK | Inget behöver göras |
| ⚠️ Gammal data | Placeholder-namn i cache | Rensa cache |
| ℹ️ Tom cache | Ingen cache | Inget behöver göras |

---

## 🧹 Rensa Cache (Om Behövs)

```javascript
localStorage.clear();
location.reload();
```

**Detta:**
- ✅ Raderar gammal cache
- ✅ Laddar om sidan
- ✅ Hämtar frisk data från Supabase
- ✅ Tar 2 sekunder

---

**KLART! Kopiera scriptet ovan och kör i Console nu.** 🚀
