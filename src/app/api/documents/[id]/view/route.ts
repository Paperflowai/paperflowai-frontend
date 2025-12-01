import { NextResponse } from "next/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

export async function GET(_req: Request, context: any) {
  const id = decodeURIComponent(String(context?.params?.id ?? ""));
  if (!id) {
    return NextResponse.json({ error: "missing id" }, { status: 400 });
  }

  if (!admin) {
    return NextResponse.json(
      { error: "Supabase is not configured" },
      { status: 503 }
    );
  }

  // Hämta dokumentraden
  const row = await admin
    .from("documents")
    .select("id, url, file_url, pdf_url, storage_path, bucket, bucket_name")
    .eq("id", id)
    .single();

  if (row.error || !row.data) {
    return NextResponse.json(
      { error: row.error?.message || "not found" },
      { status: 404 }
    );
  }

  const r: any = row.data;
  const bucket = r.bucket || r.bucket_name || "offers";
  const path: string | null = r.storage_path || null;

  // 1) Direkt-URL i tabellen?
  let url: string | null = r.url || r.file_url || r.pdf_url || null;

  // 2) Annars: public URL från Storage om vi har path
  if (!url && path) {
    const pub = admin.storage.from(bucket).getPublicUrl(path);
    url = pub.data?.publicUrl || null;
  }

  // 3) Sista utväg: signed URL
  if (!url && path) {
    const signed = await admin.storage.from(bucket).createSignedUrl(path, 60 * 60);
    if (signed.error) {
      return NextResponse.json(
        { error: signed.error.message },
        { status: 500 }
      );
    }
    url = signed.data?.signedUrl || null;
  }

  if (!url) {
    return NextResponse.json({ error: "no url" }, { status: 404 });
  }

  return NextResponse.json({ url });
}
