// src/app/api/pdf/upload/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Env-fallbacks som funkar i alla miljöer
const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const BUCKET = process.env.NEXT_PUBLIC_SUPABASE_BUCKET || "docs";

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false },
});

const clean = (s: string) => s.replace(/[^\w.\-]+/g, "_");

export async function POST(req: Request, context: any) {
  try {
    const form = await req.formData().catch(() => null);
    if (!form) {
      return NextResponse.json({ ok: false, error: "invalid form-data" }, { status: 400 });
    }

    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: "No file uploaded" }, { status: 400 });
    }
    if (!/pdf/i.test(file.type)) {
      return NextResponse.json({ ok: false, error: "PDF only" }, { status: 415 });
    }

    // Se till att bucketen finns och är publik (best effort)
    try { await admin.storage.createBucket(BUCKET, { public: true }); } catch {}
    try { await admin.storage.updateBucket(BUCKET, { public: true }); } catch {}

    const bytes = Buffer.from(await file.arrayBuffer());
    const now = new Date();
    const prefix = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}/${String(
      now.getDate()
    ).padStart(2, "0")}`;
    const fileName = `${Date.now()}-${clean(file.name)}`;
    const path = `${prefix}/${fileName}`;

    const { error: upErr } = await admin.storage
      .from(BUCKET)
      .upload(path, bytes, { contentType: "application/pdf", upsert: true });

    if (upErr) {
      return NextResponse.json({ ok: false, error: upErr.message, where: "storage.upload" }, { status: 500 });
    }

    // Public URL eller signed URL som fallback
    let url = admin.storage.from(BUCKET).getPublicUrl(path).data?.publicUrl ?? null;
    if (!url) {
      const signed = await admin.storage.from(BUCKET).createSignedUrl(path, 60 * 60);
      if (signed.error) {
        return NextResponse.json({ ok: false, error: signed.error.message, where: "storage.signedUrl" }, { status: 500 });
      }
      url = signed.data?.signedUrl || null;
    }

    // Extrahera text – dynamisk import för att undvika build-problem
    let textContent = "";
    try {
      const mod: any = await import("pdf-parse").catch(() => null);
      if (mod?.default) {
        const parsed = await mod.default(bytes);
        textContent = parsed?.text || "";
      }
    } catch {
      // ignore parse errors
    }

    return NextResponse.json({
      ok: true,
      bucket: BUCKET,
      path,
      url,
      name: file.name,
      size: bytes.length,
      textContent,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Upload failed" }, { status: 500 });
  }
}
