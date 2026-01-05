# Felanalys: GPT-koppling fungerar inte

## Vad som hände

Du fick felmeddelandet:
> "Det gick inte att spara offerten i PaperflowAI just nu — systemet meddelade ett tekniskt fel (kund-id kunde inte hanteras korrekt)."

## Vad jag gjorde

Jag ändrade:
1. ✅ `src/app/dashboard/page.tsx` - Lade till `company_name` i SELECT-query
2. ✅ `src/app/api/customer-cards/get/route.ts` - Lade till `company_name` i SELECT-query

**VIKTIGT:** Dessa ändringar påverkar INTE GPT API:et (`/api/offers/create-from-gpt`)!
- Dashboard-ändringen påverkar bara hur kunder visas i listan
- Customer-cards API:et är bara för GET-requests (att läsa kundkort)

## Vad jag gjorde nu

✅ **Återställde alla mina ändringar** med `git restore`

## Möjliga orsaker till felet

### 1. Felet existerade redan innan mina ändringar
Du hade redan staged changes i `create-from-gpt/route.ts` (från tidigare). Felet kan komma därifrån.

### 2. Timeout eller databasproblem
GPT:en kanske timeout:ade eller Supabase hade ett tillfälligt problem.

### 3. Felaktig customerId från GPT
GPT skickar kanske `customerId: "undefined"` eller något annat ogiltigt värde.

### 4. Vercel deployment-problem
Om du är på Vercel (produktion), kanske den gamla koden fortfarande körs.

## Nästa steg - TESTA DETTA

### Test 1: Testa lokalt
```bash
npm run dev
```

Sedan skapa en testoffert via GPT. Kolla console-loggar för:
```
[create-from-gpt] 📦 Raw jsonData: { ... }
[create-from-gpt] customerId: ???
```

### Test 2: Kolla vad GPT faktiskt skickar

När GPT försöker skapa en offert, be den visa **exakt JSON** som den skickar.

Det borde se ut så här:
```json
{
  "customerId": null,
  "jsonData": {
    "kund": {
      "namn": "Företagsnamn AB",
      "email": "info@foretag.se"
    }
  },
  "textData": "..."
}
```

**Kolla:**
- Är `customerId` null, undefined, eller en sträng?
- Finns `jsonData.kund.namn`?

### Test 3: Kolla om det fungerar igen nu

Eftersom jag återställde ändringarna, testa att skapa en offert igen.

**Fungerar det nu?**
- ✅ Ja → Felet var från mina ändringar (osannolikt, men möjligt)
- ❌ Nej → Felet existerade redan innan

### Test 4: Kolla backend-loggar

Om du kör `npm run dev`, se efter fel i console när GPT försöker skapa offert.

Sök efter:
- `[create-from-gpt]` - mina debug-meddelanden
- `Error` - eventuella fel
- `Missing customerId` - om customerId saknas

## Om felet kvarstår

**Skicka mig:**
1. Backend-loggar från `npm run dev` när du försöker skapa en offert
2. Exakt JSON som GPT skickar (be GPT visa det)
3. Screenshot av felmeddelandet

## Snabb diagnos

**Kör detta i din terminal:**
```bash
npm run dev
```

**Sedan skapa en testoffert via GPT och leta efter:**
```
[create-from-gpt] Creating new customer: [kund-id]
```

eller

```
[create-from-gpt] Updating existing customer: [kund-id]
```

**Vad ser du?**
- Om du ser ett kund-id → API:et fungerar
- Om du ser ett fel → Det är där problemet ligger

## Mina ändringar har NU återställts

Allt är tillbaka till hur det var innan jag började.

**Testa om GPT-kopplingen fungerar igen nu.**
