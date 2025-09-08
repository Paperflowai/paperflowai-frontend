import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs"; // behövs för FormData i app routes

function resolveBackendUrl(): string {
  const env = (process.env.PYTHON_OCR_URL || "").trim();
  const invalid = !env || env === "undefined" || env === "null" || !/^https?:\/\//i.test(env);
  return invalid ? "http://127.0.0.1:5000/ocr" : env;
}

export async function POST(req: NextRequest) {
  const ct = req.headers.get("content-type") || "";
  if (!ct.toLowerCase().startsWith("multipart/form-data")) {
    return NextResponse.json({ error: "expected multipart/form-data" }, { status: 400 });
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "no file" }, { status: 400 });
  }

  const pyUrl = resolveBackendUrl();
  const fd = new FormData();
  fd.append("file", file, file.name);

  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), 8000);

  try {
    const r = await fetch(pyUrl, { method: "POST", body: fd, signal: controller.signal });
    clearTimeout(id);
    const text = await r.text();
    if (!r.ok) {
      let body: any = text;
      try { body = JSON.parse(text); } catch {}
      return NextResponse.json({ error: "backend failed", status: r.status, backend: body, url: pyUrl }, { status: 502 });
    }
    let data: any = null;
    try { data = JSON.parse(text); } catch {
      return NextResponse.json({ error: "invalid json from backend", raw: text, url: pyUrl }, { status: 502 });
    }
    return NextResponse.json(data);
  } catch (e: any) {
    clearTimeout(id);
    const timedOut = e?.name === "AbortError";
    return NextResponse.json({ error: timedOut ? "timeout" : "fetch_failed", detail: String(e), url: pyUrl }, { status: 502 });
  }
}
