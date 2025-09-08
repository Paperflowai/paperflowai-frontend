// src/app/api/ocr/health/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";

function resolveBackendUrl(): string {
  const env = (process.env.PYTHON_OCR_URL || "").trim();
  const invalid = !env || env === "undefined" || env === "null" || !/^https?:\/\//i.test(env);
  return invalid ? "http://127.0.0.1:5000/ocr" : env;
}

export async function GET() {
  const base = resolveBackendUrl();
  const healthUrl = base.replace(/\/ocr\/?$/, "/health");

  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), 4000);

  const startedAt = Date.now();
  try {
    const r = await fetch(healthUrl, { cache: "no-store", signal: controller.signal });
    clearTimeout(id);
    const ms = Date.now() - startedAt;
    const text = await r.text();
    let json: any = null;
    try { json = JSON.parse(text); } catch {}
    return NextResponse.json({ ok: r.ok, status: r.status, ms, url: healthUrl, body: json ?? text });
  } catch (e: any) {
    clearTimeout(id);
    const ms = Date.now() - startedAt;
    return NextResponse.json({ ok: false, error: String(e?.name === 'AbortError' ? 'timeout' : e), ms, url: healthUrl }, { status: 502 });
  }
}
