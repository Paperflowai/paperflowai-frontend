import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// 🔐 Server-side Supabase (service role) – körs bara på servern
const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE) {
  throw new Error("Saknar SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY i env");
}
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false },
});

// 🚧 Blockera test/demo/kundkort om inte uttryckligen tillåtet
const ALLOW_TEST_CREATION = process.env.ALLOW_TEST_CREATION === "true";
const looksLikeTest = (s?: string | null) =>
  !!s && /(^(test|demo|kundkort)-|test|demo|kundkort)/i.test(s);

export async function POST(req: Request) {
  let body: any = {};
  try {
    body = await req.json();
  } catch {}

  const id = typeof body?.id === "string" ? body.id.trim() : "";
  const name =
    typeof body?.name === "string" && body.name.trim().length > 0
      ? body.name.trim()
      : null;
  // OBS: vi skriver inte 'slug' eftersom din tabell sannolikt saknar den kolumnen

  // ⛔ Tidig block för test/dummy
  if (!ALLOW_TEST_CREATION && (looksLikeTest(id) || looksLikeTest(name))) {
    return NextResponse.json(
      {
        error:
          "Test/demo-kund blockeras i dev. Sätt ALLOW_TEST_CREATION=true om du vill tillåta tillfälligt.",
      },
      { status: 409 }
    );
  }

  // ✅ Krav: id måste finnas (t.ex. 'kund1' eller 'sandbox')
  if (!id) {
    return NextResponse.json(
      { error: "Fältet 'id' krävs (t.ex. 'kund1')." },
      { status: 400 }
    );
  }

  // ✍️ Skriv raden (upsert = skapa eller uppdatera om id redan finns)
  const row = { id, name }; // lägg bara med kolumner som garanterat finns
  const { data, error } = await supabase
    .from("customers")
    .upsert(row, { onConflict: "id" })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(
    {
      ok: true,
      customer: data,
      url: `http://localhost:3000/kund/${data.id}`,
    },
    { status: 201 }
  );
}


