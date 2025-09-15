import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!url || !anon) {
  // Hjälpsam throw i dev – gör inget i prod om du vill
  console.warn("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
}

export const supabase = createClient(url, anon);

// --- Database type definition ---
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