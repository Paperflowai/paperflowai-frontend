import { NextResponse } from "next/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;

const admin: SupabaseClient | null =
  SUPABASE_URL && SERVICE_ROLE
    ? createClient(SUPABASE_URL, SERVICE_ROLE, {
        auth: { persistSession: false },
      })
    : null;

function derivePath(url: string, bucket: string) {
  try {
    const needle = `/${bucket}/`;
    const idx = url.indexOf(needle);
    if (idx >= 0) return url.slice(idx + needle.length);
  } catch {}
  return null;
}

// ⬇⬇⬇ VIKTIGT: "context: any" i Next 15
export async function DELETE(_req: Request, context: any) {
  const id = decodeURIComponent(String(context?.params?.id ?? ""));
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });

  if (!admin) {
    return NextResponse.json(
      { error: "Supabase is not configured" },
      { status: 503 }
    );
  }

  // Hämta raden
  const sel = await admin.from("documents").select("*").eq("id", id).single();
  if (sel.error || !sel.data) {
    return NextResponse.json(
      { error: sel.error?.message || "not found", where: "select" },
      { status: 404 }
    );
  }
  const row: any = sel.data;

  // Bestäm bucket + path
  const bucket = row.bucket || row.bucket_name || "offers";
  let path = row.storage_path || null;
  if (!path) {
    const u = row.url || row.file_url || row.pdf_url;
    if (u) path = derivePath(String(u), bucket);
  }

  // Ta bort fil i Storage (om vi kan räkna ut path)
  if (path) {
    try { await admin.storage.from(bucket).remove([path]); } catch {}
  }

  // Ta bort DB-rad
  const del = await admin.from("documents").delete().eq("id", id);
  if (del.error) {
    return NextResponse.json({ error: del.error.message, where: "delete" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
