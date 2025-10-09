import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

export async function GET(_req: Request, ctx: { params: { id: string } }) {
  const id = decodeURIComponent(ctx.params.id || "");
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });

  const row = await admin.from("documents").select("*").eq("id", id).single();
  if (row.error || !row.data) return NextResponse.json({ error: row.error?.message || "not found" }, { status: 404 });
  const r: any = row.data;

  let url: string | null = r.url || r.file_url || r.pdf_url || null;
  const bucket = r.bucket || r.bucket_name || "offers";
  const path = r.storage_path || null;

  if (!url && path) {
    const pub = admin.storage.from(bucket).getPublicUrl(path);
    url = pub.data?.publicUrl || null;
  }
  if (!url && path) {
    const signed = await admin.storage.from(bucket).createSignedUrl(path, 60 * 60);
    if (signed.error) return NextResponse.json({ error: signed.error.message }, { status: 500 });
    url = signed.data?.signedUrl || null;
  }

  if (!url) return NextResponse.json({ error: "no url" }, { status: 404 });
  return NextResponse.json({ url });
}



