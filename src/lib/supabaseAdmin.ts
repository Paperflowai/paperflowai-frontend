// src/lib/supabaseAdmin.ts
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const supabaseAdminConfigured = Boolean(
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
);

// Använder service-rollen (bypassar RLS på serversidan). Locally, when Supabase
// isn’t configured, we still create a harmless client with a mocked fetch so
// imports never crash while you use local demo data.
const mockFetch: typeof fetch = async () =>
  new Response(
    JSON.stringify({ error: "Supabase admin not configured" }),
    { status: 503, headers: { "Content-Type": "application/json" } }
  );

export const supabaseAdmin = createClient(
  SUPABASE_URL || "https://disabled.supabase.local",
  SUPABASE_SERVICE_ROLE_KEY || "service-role-key",
  supabaseAdminConfigured
    ? { auth: { persistSession: false, autoRefreshToken: false } }
    : { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: mockFetch } }
);
