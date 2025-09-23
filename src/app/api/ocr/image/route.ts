import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ ok: false, error: "No image uploaded" }, { status: 400 });
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const b64 = bytes.toString("base64");
    const dataUrl = `data:${file.type || "image/jpeg"};base64,${b64}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "Läs ut all läsbar text från bilden. Returnera bara ren text." },
            { type: "image_url", image_url: { url: dataUrl } }
          ] as any
        }
      ]
    });

    const text = completion.choices?.[0]?.message?.content || "";
    return NextResponse.json({ ok: true, text });
  } catch (e: any) {
    console.error("ocr error", e);
    return NextResponse.json({ ok: false, error: e.message || "OCR failed" }, { status: 500 });
  }
}
