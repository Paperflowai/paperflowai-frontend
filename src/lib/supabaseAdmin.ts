// src/lib/supabaseAdmin.ts
import { createClient } from "@supabase/supabase-js";

// Använder service-rollen (bypassar RLS på serversidan)
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,      // samma URL som du redan använder
  process.env.SUPABASE_SERVICE_ROLE_KEY!,     // ***viktig: service role key***
  {
    auth: { persistSession: false, autoRefreshToken: false },
  }
);
