// src/app/api/ocr/echo/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const ct = req.headers.get("content-type") || "";
  if (!ct.toLowerCase().startsWith("multipart/form-data")) {
    return NextResponse.json({ ok: false, error: "expected multipart/form-data" }, { status: 400 });
  }
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "no file" }, { status: 400 });
  }
  const buf = Buffer.from(await file.arrayBuffer());
  return NextResponse.json({ ok: true, name: file.name, size: buf.length, type: file.type });
}
