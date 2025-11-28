// src/lib/supabaseAdmin.ts
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error(
    "Missing Supabase admin env vars. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to connect."
  );
}

// Använder service-rollen (bypassar RLS på serversidan)
export const supabaseAdmin = createClient(
  SUPABASE_URL,      // samma URL som du redan använder
  SUPABASE_SERVICE_ROLE_KEY,     // ***viktig: service role key***
  {
    auth: { persistSession: false, autoRefreshToken: false },
  }
);
