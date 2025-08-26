export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BASE = "http://127.0.0.1:5000";
export async function GET() {
  try {
    const res = await fetch(`${BASE}/health`, { cache: "no-store" });
    const body = await res.text();
    return new Response(body, {
      status: res.status,
      headers: { "content-type": res.headers.get("content-type") || "application/json" },
    });
  } catch (e: any) {
    return Response.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
