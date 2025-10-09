// scripts/upsert-kund1.mjs
// Körs med: node --env-file=.env.local scripts/upsert-kund1.mjs
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error('Saknar SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL eller SUPABASE_SERVICE_ROLE_KEY (laddas via --env-file).');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

async function main() {
  const row = { id: 'kund1', name: 'Kund 1' };
  const { data, error } = await supabase
    .from('customers')
    .upsert(row, { onConflict: 'id' })
    .select();

  if (error) {
    console.error('Fel vid upsert:', error);
    process.exit(1);
  }

  console.log('✅ Upsert klar. Posten är nu:', data?.[0] || data);
  console.log('URL: http://localhost:3000/kund/kund1');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});





