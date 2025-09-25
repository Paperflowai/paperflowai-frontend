// scripts/cleanup-test-customers.mjs
// Körs med: node --env-file=.env.local scripts/cleanup-test-customers.mjs [--apply]
import { createClient } from '@supabase/supabase-js';

const KEEP_ID_OR_SLUG = 'kund1'; // behålls alltid

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error(
    'Saknar SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL eller SUPABASE_SERVICE_ROLE_KEY (laddas via --env-file).'
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false },
});

const toUrl = (row) => `http://localhost:3000/kund/${row.slug || row.id}`;

async function selectCandidates(useSlug) {
  let q = supabase.from('customers').select(
    useSlug ? 'id,slug,name,created_at' : 'id,name,created_at'
  );

  // matcha test/dummy-sluggar & namn
  const orClause = [
    'id.ilike.test-%',
    'id.ilike.demo-%',
    'id.ilike.kundkort-%',
    useSlug ? 'slug.ilike.test-%' : null,
    useSlug ? 'slug.ilike.demo-%' : null,
    useSlug ? 'slug.ilike.kundkort-%' : null,
    'name.ilike.%test%',
    'name.ilike.%demo%',
  ]
    .filter(Boolean)
    .join(',');

  q = q.or(orClause).neq('id', KEEP_ID_OR_SLUG);
  if (useSlug) q = q.neq('slug', KEEP_ID_OR_SLUG);

  const { data, error } = await q;
  return { data: data || [], error };
}

async function main() {
  const apply = process.argv.includes('--apply');

  // Försök med slug-kolumn; om den saknas, fallback utan slug
  let { data, error } = await selectCandidates(true);
  let rows = [];
  if (error) {
    console.warn('Slug saknas eller kolumnfel – försöker utan slug…');
    const res2 = await selectCandidates(false);
    if (res2.error) {
      console.error(res2.error);
      process.exit(1);
    }
    rows = res2.data;
  } else {
    rows = data;
  }

  // Extra skydd om något ändå skulle råka heta KEEP_ID_OR_SLUG
  rows = rows.filter(
    (r) => r.id !== KEEP_ID_OR_SLUG && (r.slug || '') !== KEEP_ID_OR_SLUG
  );

  console.log(`\n🔎 Hittade ${rows.length} kandidater att städa:`);
  rows.forEach((r) => console.log(' -', toUrl(r)));

  if (!apply) {
    console.log('\n⚠️  Dry-run. Kör med --apply för att radera posterna ovan.');
    process.exit(0);
  }

  if (rows.length === 0) {
    console.log('Inget att radera. ✅');
    process.exit(0);
  }

  const ids = rows.map((r) => r.id);

  // Om du inte har ON DELETE CASCADE i barn-tabeller, radera dem först här:
  // await supabase.from('offers').delete().in('customer_id', ids);
  // await supabase.from('orders').delete().in('customer_id', ids);
  // await supabase.from('invoices').delete().in('customer_id', ids);

  const del = await supabase.from('customers').delete().in('id', ids);
  if (del.error) {
    console.error('Fel vid radering:', del.error);
    process.exit(1);
  }
  console.log(`\n🧹 Raderade ${rows.length} kunder. ✅`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});


