#!/bin/bash
# Test script för GPT Actions API
# Kör detta för att testa att API:et fungerar innan du konfigurerar GPT

# Byt ut denna URL till din faktiska plattforms-URL
API_URL="http://localhost:3000/api/offers/create-from-gpt"

echo "🧪 Testar GPT Actions API: $API_URL"
echo ""

curl -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": null,
    "jsonData": {
      "offertnummer": "OFF-2026-0001",
      "datum": "2026-01-02",
      "titel": "Offert för webbutveckling",
      "summa": 118000,
      "valuta": "SEK",
      "kund": {
        "namn": "Test AB",
        "orgnr": "556677-8899",
        "kontaktperson": "Test Testsson",
        "epost": "test@test.se",
        "telefon": "070-123 45 67",
        "adress": "Testgatan 1",
        "postnummer": "123 45",
        "ort": "Stockholm",
        "land": "Sverige",
        "befattning": "VD"
      }
    },
    "textData": "# OFFERT\n\nKund: Test AB\nDatum: 2026-01-02\nOffertnummer: OFF-2026-0001\n\n## Kundinformation\nOrg.nr: 556677-8899\nAdress: Testgatan 1\nKontaktperson: Test Testsson\nTelefon: 070-123 45 67\nE-post: test@test.se\n\n## Tjänster\n- Systemanalys: 20 tim × 1200 kr = 24 000 kr\n- Frontend utveckling: 40 tim × 1200 kr = 48 000 kr\n- Backend utveckling: 30 tim × 1200 kr = 36 000 kr\n- SEO-optimering: 10 tim × 1000 kr = 10 000 kr\n\nTotalsumma: 118 000 SEK exkl. moms\n\n## Betalningsvillkor\nBetaltid: 30 dagar\n\n## Giltighet\nDenna offert är giltig i 30 dagar."
  }'

echo ""
echo ""
echo "✅ Om du ser ett svar med 'ok: true', 'customerId' och 'customerData' fungerar API:et!"
echo "📋 Gå nu till plattformen och kolla att kunden 'Test AB' finns i Dashboard"
