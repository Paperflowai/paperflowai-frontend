import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const rawAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

// Use explicit defaults so `createClient` never receives an undefined URL, which
// would throw in browsers when Supabase isn’t configured (e.g. local demo mode).
const FALLBACK_URL = "https://disabled.supabase.local";
const FALLBACK_ANON = "public-anon-key";

// Let the app run locally without Supabase by falling back to a harmless mock client
// that always responds with an error. Vercel/production will provide real env vars
// so the real client is used there.
export const supabaseConfigured = Boolean(rawUrl && rawAnon);

const mockFetch: typeof fetch = async () =>
  new Response(
    JSON.stringify({ error: "Supabase not configured" }),
    { status: 503, headers: { "Content-Type": "application/json" } }
  );

let client: SupabaseClient;

try {
  // createClient can throw if the URL is missing/invalid. In local/demo runs we
  // still want a harmless mock client so the UI can render without crashing.
  client = createClient(
    rawUrl || FALLBACK_URL,
    rawAnon || FALLBACK_ANON,
    supabaseConfigured ? undefined : { global: { fetch: mockFetch } }
  );
} catch (error) {
  // Fall back to a mock client that always yields a 503-style response. This
  // keeps client-side renders alive even if env vars are empty or malformed.
  client = createClient(FALLBACK_URL, FALLBACK_ANON, {
    global: { fetch: mockFetch },
  });
}

export const supabase: SupabaseClient = client;

// --- Temporary typing shim: export Database type used by supabaseDatabase.ts ---
// Byt gärna mot genererade typer från Supabase senare.
export type Database = {
  public: {
    Tables: {
      customers: {
        Row: {
          id: string;
          name: string;
          orgnr: string | null;
          email: string | null;
          phone: string | null;
          address: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          orgnr?: string | null;
          email?: string | null;
          phone?: string | null;
          address?: string | null;
          created_at?: string;
        };
      };
    };
  };
};
