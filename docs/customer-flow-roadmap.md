# Offer → Order → Invoice flow: current pieces and required functions

## What already exists
- **Offer → Order PDF stamping**: `/api/orders/create-from-offer` downloads the latest offer PDF from Supabase Storage, stamps it as an order confirmation, re-uploads it, and stores a `documents` row for the customer. This is what the dashboard "Skapa order" button calls today. 【F:src/app/api/orders/create-from-offer/route.ts†L1-L174】
- **Per-customer flow status**: `useFlowStatusSupabase` (via `flowStatus.ts`) persists offer/order/invoice flags either to Supabase (`flow_status` table) or to localStorage when Supabase is absent, so the UI can reflect whether an order or invoice has been created or sent. 【F:src/lib/flowStatus.ts†L3-L97】【F:src/app/kund/[id]/page.tsx†L283-L349】
- **Customer autofill and document slots**: The customer detail page already hydrates blank Kunduppgifter fields from Supabase/hook data and tracks offer/order/invoice document placeholders so the left-hand data can move through the flow. 【F:src/app/kund/[id]/page.tsx†L351-L398】

## Functions needed for a complete flow
1. **Offer send + audit trail**
   - Add a server action or API route (e.g., `/api/offers/send`) that marks an offer as sent, records a timestamp, and updates `flow_status.offer_sent`. Reuse it from the existing "Skicka" button so both the UI label and downstream steps know the offer has left draft state.
2. **Order → Invoice generator**
   - Mirror `create-from-offer` with a `/api/invoices/create-from-order` route that stamps/augments the order PDF into an invoice, uploads it to Storage, writes a `documents` row, and toggles `flow_status.invoice_created`. Keep bucket/path conventions consistent with the order step to avoid collisions.
3. **Document linking + Supabase row ownership**
   - When creating orders or invoices, also upsert a lightweight `orders`/`invoices` table row that links the document path, customer_id, and originating offer/order ID. This makes it possible to show the latest status on the dashboard and prevent duplicate generation for the same source.
4. **Auto-progress hooks for JSON/GPT imports**
   - Extend the JSON hook ingestion to optionally kick off offer creation when an external payload arrives (e.g., flag `autoCreateOffer: true`). After an offer PDF is rendered, automatically call the order/invoice endpoints when their prerequisites are satisfied and `flow_status` shows blanks.
5. **Python-side validators (optional)**
   - In `python-scripts/parse-service`, add a small worker that can validate incoming JSON/PDF payloads and call the hook endpoint to register customers, ensuring local/demo runs can simulate the same flow without Supabase.

## Why this prevents collisions
- Reusing the single flow-status source and inserting Supabase rows for each generated document keeps IDs and customer numbers consistent, avoiding the dual local/Supabase storage collisions we saw previously while still supporting offline/demo data.
