// scripts/list-customers.mjs
// Körs med: node --env-file=.env.local scripts/list-customers.mjs
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error('Saknar SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL eller SUPABASE_SERVICE_ROLE_KEY (laddas via --env-file).');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
const toUrl = (row) => `http://localhost:3000/kund/${row.slug || row.id}`;

async function tryQuery(selectCols, orderBy) {
  let q = supabase.from('customers').select(selectCols);
  if (orderBy) q = q.order(orderBy, { ascending: false });
  const { data, error } = await q.limit(500);
  return { data: data || [], error };
}

async function main() {
  // 1) Försök: id, slug, name, created_at (ordna på created_at)
  let res = await tryQuery('id, slug, name, created_at', 'created_at');
  if (res.error) {
    console.warn('Slug/created_at saknas eller kolumnfel – försöker utan slug …');
    // 2) Försök: id, name, created_at (ordna på created_at)
    res = await tryQuery('id, name, created_at', 'created_at');
  }
  if (res.error) {
    console.warn('created_at saknas – försöker utan order …');
    // 3) Sista: id, name (ingen ordning)
    res = await tryQuery('id, name', null);
  }
  if (res.error) {
    console.error('Fel vid hämtning:', res.error);
    process.exit(1);
  }

  const data = res.data;
  if (!data || data.length === 0) {
    console.log('Inga kunder hittades.');
    return;
  }

  console.log(`\nTotalt hämtat: ${data.length} kunder\n`);
  for (const r of data) {
    const id = r.id ?? '(saknas)';
    const slug = r.slug ?? '(saknas)';
    const name = r.name ?? '(saknas)';
    console.log(`- id=${id}  slug=${slug}  name=${name}  url=${toUrl(r)}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});


