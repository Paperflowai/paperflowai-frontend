export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { checkLimit } from "@/lib/rateLimit/redis";

function err(code: string, message: string, status = 400, details?: any) {
  return NextResponse.json({ ok: false, code, message, ...(details && { details }) }, { status });
}

function ipFrom(req: NextRequest) {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    req.headers.get("cf-connecting-ip") ||
    "unknown"
  );
}

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const file = form.get("file") as File | null;

  if (!file) return err("NO_FILE", "No file provided");
  if (!/^image\/(jpeg|png|webp)$/.test(file.type || "")) {
    return err("INVALID_MIME_TYPE", "Only JPG/PNG/WEBP allowed");
  }

  const maxMb = Number(process.env.NEXT_PUBLIC_MAX_UPLOAD_MB ?? 15);
  if (file.size > maxMb * 1024 * 1024) {
    return err("FILE_TOO_LARGE", `File too large. Maximum size is ${maxMb}MB`, 413, {
      maxSizeMb: maxMb,
      actualSizeMb: Math.round((file.size / 1024 / 1024) * 100) / 100,
    });
  }

  // Rate limit (separat nyckel för kvittoflöde)
  const rl = await checkLimit(`receipt:${ipFrom(req)}`, Number(process.env.RATE_LIMIT_MAX ?? 30), Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60_000));
  if (!rl.success) {
    return err("RATE_LIMIT_EXCEEDED", "Too many requests. Please try again later.", 429, {
      limit: rl.limit, remaining: rl.remaining, retryAfter: rl.retryAfter
    });
  }

  const base = process.env.PDF_BACKEND_URL || "http://localhost:8000";
  const url = `${base}/extract-image?lang=${encodeURIComponent("swe+eng")}&mode=receipt`;

  const fd = new FormData();
  fd.append("file", file);

  const headers: Record<string, string> = {};
  if (process.env.PDF_API_KEY) headers["X-Api-Key"] = process.env.PDF_API_KEY;

  let res: Response;
  try {
    const controller = new AbortController();
    const timeout = Number(process.env.BACKEND_TIMEOUT_MS ?? 30_000);
    const t = setTimeout(() => controller.abort(), timeout);

    res = await fetch(url, { method: "POST", body: fd, headers, signal: controller.signal });
    clearTimeout(t);
  } catch (e: any) {
    const isTimeout = e?.name === "AbortError";
    return err(isTimeout ? "BACKEND_TIMEOUT" : "BACKEND_ERROR", isTimeout ? "Backend request timed out" : "Failed to reach backend", isTimeout ? 504 : 502);
  }

  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: { 
      "Content-Type": res.headers.get("Content-Type") || "application/json",
      "X-RateLimit-Limit": String(rl.limit),
      "X-RateLimit-Remaining": String(rl.remaining),
      "X-RateLimit-Reset": String(Math.floor(rl.reset.getTime() / 1000))
    }
  });
}
