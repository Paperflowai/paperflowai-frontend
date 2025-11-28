import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Let the app run locally without Supabase by falling back to a harmless mock client
// that always responds with an error. Vercel/production will provide real env vars
// so the real client is used there.
export const supabaseConfigured = Boolean(url && anon);

const mockFetch: typeof fetch = async () =>
  new Response(
    JSON.stringify({ error: "Supabase not configured" }),
    { status: 503, headers: { "Content-Type": "application/json" } }
  );

export const supabase: SupabaseClient = createClient(
  url || "https://disabled.supabase.local",
  anon || "public-anon-key",
  supabaseConfigured ? undefined : { global: { fetch: mockFetch } }
);

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
