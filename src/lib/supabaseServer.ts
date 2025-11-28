import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY as string | undefined;

export const supabaseAdminConfigured = Boolean(
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
);

const mockFetch: typeof fetch = async () =>
  new Response(
    JSON.stringify({ error: "Supabase service role not configured" }),
    { status: 503, headers: { "Content-Type": "application/json" } }
  );

export const supabaseAdmin = createClient(
  SUPABASE_URL || "https://disabled.supabase.local",
  SUPABASE_SERVICE_ROLE_KEY || "service-role-key",
  supabaseAdminConfigured
    ? { auth: { persistSession: false } }
    : { auth: { persistSession: false }, global: { fetch: mockFetch } }
);
