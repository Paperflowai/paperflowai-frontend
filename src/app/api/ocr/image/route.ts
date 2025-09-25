import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
const supabase = createClient(
  (process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL)!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const STORAGE_BUCKET = "docs";

async function ensureBucketExists() {
  const { data: existing, error: getErr } = await supabase.storage.getBucket(STORAGE_BUCKET);
  if (existing) return;
  if (getErr && (getErr as any)?.statusCode !== "404") {
    throw getErr;
  }
  const { error: createErr } = await supabase.storage.createBucket(STORAGE_BUCKET, {
    public: false,
    fileSizeLimit: 50 * 1024 * 1024,
  } as any);
  if (createErr) throw createErr;
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ ok: false, error: "No image uploaded" }, { status: 400 });
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const filePath = `receipts/${Date.now()}-${file.name}`;

    // Ensure bucket exists (service role key required)
    await ensureBucketExists();

    const { error: uploadErr } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(filePath, bytes, { contentType: file.type || "image/jpeg" });
    if (uploadErr) throw uploadErr;

    const base64Image = bytes.toString("base64");
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                "Extrahera kvittodata och returnera exakt JSON: { \"document_type\": \"receipt\", \"date\": \"YYYY-MM-DD\", \"amount\": number, \"vat\": number, \"currency\": \"SEK\", \"filePath\": \"string\" }",
            },
            { type: "image_url", image_url: { url: `data:${file.type || "image/jpeg"};base64,${base64Image}` } },
          ] as any,
        },
      ],
      response_format: { type: "json_object" },
    });

    const content = completion.choices?.[0]?.message?.content || "";
    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch {
      // Fallback: extract first JSON object if the model wrapped it in text/fences
      const match = content.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          parsed = JSON.parse(match[0]);
        } catch {
          return NextResponse.json({ ok: false, error: "Invalid JSON from OCR model" }, { status: 400 });
        }
      } else {
        return NextResponse.json({ ok: false, error: "Empty or invalid OCR response" }, { status: 400 });
      }
    }

    // Ensure minimal required structure
    if (parsed && typeof parsed === "object") {
      parsed.document_type = "receipt";
      if (!parsed.currency) parsed.currency = "SEK";
    }
    if (!parsed.filePath) parsed.filePath = filePath;

    const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/docs/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    return NextResponse.json({ ok: true, result: data });
  } catch (e: any) {
    console.error("ocr error", e);
    return NextResponse.json({ ok: false, error: e.message || "OCR failed" }, { status: 500 });
  }
}
