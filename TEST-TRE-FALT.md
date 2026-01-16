# Test: Fyll i de tre fälten manuellt

## Steg 1: Testa manuell ifyllning
1. Öppna ett kundkort i webbläsaren
2. Scrolla ner till de tre fälten:
   - Fastighetsbeteckning
   - Förening org.nr
   - Personnummer
3. Fyll i följande värden:
   - Fastighetsbeteckning: **TEST123**
   - Förening org.nr: **111111-2222**
   - Personnummer: **198501011234**
4. Öppna Chrome DevTools (F12) → Console
5. Skriv följande och tryck Enter:

```javascript
fetch('/api/customers/[DITT-CUSTOMER-ID-HÄR]', {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    property_designation: 'TEST123',
    association_orgnr: '111111-2222',
    personal_number: '198501011234'
  })
}).then(r => r.json()).then(console.log)
```

6. Ladda om sidan (F5)
7. Är fälten fortfarande ifyllda?

## Steg 2: Kolla Supabase direkt
1. Gå till Supabase Table Editor
2. Öppna `customers` tabellen
3. Hitta din kund (sök på email eller namn)
4. Kolla kolumnerna:
   - `property_designation`
   - `association_orgnr`
   - `personal_number`
5. Är värdena där?

## Rapportera tillbaka:
- ✅ / ❌ Fälten visas efter omladdning
- ✅ / ❌ Värdena finns i Supabase
- Eventuella felmeddelanden i Console
