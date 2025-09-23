import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import pdf from "pdf-parse";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    if (!file) {
      return NextResponse.json({ ok: false, error: "No file uploaded" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const filePath = `offers/${Date.now()}-${file.name}`;
    const { error: uploadErr } = await supabase.storage
      .from("docs")
      .upload(filePath, buffer, { contentType: "application/pdf" });

    if (uploadErr) throw uploadErr;

    let textContent = "";
    try {
      const parsed = await pdf(buffer as Buffer);
      textContent = parsed.text || "";
    } catch {
      textContent = "";
    }

    return NextResponse.json({ ok: true, filePath, textContent });
  } catch (err) {
    console.error("upload error", err);
    return NextResponse.json({ ok: false, error: "Upload failed" }, { status: 500 });
  }
}
