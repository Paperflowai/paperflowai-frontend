# Project health audit

## Current ranking
- **Mode detected:** Demo/local fallback because Supabase admin credentials are missing in the environment.
- **Overall readiness:** Good for local/demo customer capture; blocked on Supabase storage for document linking and invoice/order stamping.

## What currently works (based on simulation)
- External customer hook storage can upsert, list, and delete customers using the file-backed store.
- Customer numbers are generated/retained uniquely for simulated records, preventing collisions across runs.
- Flow status updates persist in fallback (no-Supabase) mode, allowing offer → order → invoice progress to be tracked locally.
- The simulation cleans up after itself, leaving no `.data` artifacts behind.

## What is blocked or needs attention
- Document linking to Supabase tables/storage is skipped when admin credentials are absent, so production flows need valid `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
- Offer → order → invoice PDF handling still depends on Supabase storage buckets; without them, the API routes return 503 configuration errors.
- End-to-end automated tests are limited; only linting and this simulation currently exercise the flow logic.

## How to rerun the simulation
1. Ensure dependencies are installed (`npm install`), then run:
   ```bash
   npm run simulate:flow
   ```
2. The script will:
   - Write a temporary external customer to `.data/simulation-hooks.json`.
   - Assign or generate a unique customer number.
   - Mark offer/order/invoice flags via the server-side flow status helper.
   - Attempt to link a simulated order PDF (skipped without Supabase admin credentials).
   - Delete the simulated customer and remove the temp store file.
3. The printed JSON report shows the detected mode, flow flags before/after, document-linking result, and cleanup status.
