// src/app/api/offers/create2/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type OfferBody = {
  customerId: string;
  title?: string;
  amount?: number;
  currency?: string;
  needsPrint?: boolean;
  dataJson?: string; // full offert som string
};

function bad(msg: string, code = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status: code });
}

function safeParse(json?: string): any {
  if (!json || typeof json !== "string") return undefined;
  try { return JSON.parse(json); } catch { return undefined; }
}

function calcAmountFromData(data: any): number | undefined {
  try {
    const rows = data?.rader;
    if (!Array.isArray(rows)) return undefined;
    const total = rows.reduce((sum: number, r: any) => {
      const timmar = Number(r?.timmar ?? r?.hours ?? 0);
      const pris = Number(r?.pris_per_timme ?? r?.price_per_hour ?? 0);
      return sum + (isFinite(timmar) && isFinite(pris) ? timmar * pris : 0);
    }, 0);
    return isFinite(total) ? Math.round(total * 100) / 100 : undefined;
  } catch { return undefined; }
}

function extractCustomerDetails(raw: any) {
  const d = raw || {};
  // Stöd flera möjliga nycklar/strukturer
  const bucket = d.kund || d.customer || d.customerInfo || d.customer_data || d.client || {};
  const pick = (obj: any, keys: string[]) =>
    keys.map(k => obj?.[k]).find(v => typeof v === "string" && v.trim().length) as string | undefined;

  const name   = pick(bucket, ["namn","name","customerName"]) || pick(d, ["kundnamn","customerName"]);
  const orgnr  = pick(bucket, ["orgnr","orgNo","organisationnummer"]) || pick(d, ["orgnr","orgNo"]);
  const email  = pick(bucket, ["epost","email"]) || pick(d, ["epost","email"]);
  const phone  = pick(bucket, ["telefon","phone","tel"]) || pick(d, ["telefon","phone"]);
  const address= pick(bucket, ["adress","address"]) || pick(d, ["adress","address"]);

  return { name, orgnr, email, phone, address };
}

async function createPdfFromOffer(body: Required<Pick<OfferBody,"customerId">> & OfferBody, parsedData?: any) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]); // A4
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const marginX = 50;
  let y = 800;
  const draw = (text: string, bold = false, size = 12, color = rgb(0,0,0)) => {
    const usedFont = bold ? fontBold : font;
    page.drawText(String(text), { x: marginX, y, size, font: usedFont, color });
    y -= size + 8;
  };

  // Header
  draw("OFFERT", true, 20);
  draw(new Date().toLocaleString(), false, 10, rgb(0.4,0.4,0.4));
  y -= 6;

  // Grunddata
  draw(`Kundkort / Customer ID: ${body.customerId}`, false, 12);
  draw(`Titel: ${body.title ?? "Offert"}`, false, 12);
  draw(`Belopp: ${String(body.amount ?? 0)} ${body.currency ?? "SEK"}`, false, 12);
  draw(`Markerad för papperskopia: ${Boolean(body.needsPrint ?? false) ? "Ja" : "Nej"}`, false, 12);

  // Kort summering av dataJson
  y -= 10; draw("Sammanfattning av data:", true, 12);
  try {
    const clone = parsedData ?? {};
    const keys = Object.keys(clone).slice(0, 12);
    for (const k of keys) {
      if (y < 60) break;
      const v = typeof clone[k] === "object" ? JSON.stringify(clone[k]) : String(clone[k]);
      const line = `${k}: ${v}`.slice(0, 110);
      draw(line, false, 10);
    }
  } catch {
    draw("Kunde inte serialisera data.", false, 10);
  }

  return pdfDoc.save();
}

export async function GET() {
  return NextResponse.json({ ok: true, endpoint: "/api/offers/create2" }, { status: 200 });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as OfferBody;
    if (!body?.customerId) return bad("Missing 'customerId'");

    const data = safeParse(body.dataJson) ?? {};

    // Upsert kundkortets info i customer_cards (baserat på customerId)
    try {
      const c = extractCustomerDetails(data);
      const hasAny =
        (c.name && c.name.trim()) ||
        (c.orgnr && c.orgnr.trim()) ||
        (c.email && c.email.trim()) ||
        (c.phone && c.phone.trim()) ||
        (c.address && c.address.trim());

      if (hasAny) {
        const { error: upsertErr } = await supabaseAdmin
          .from("customer_cards")
          .upsert(
            {
              customer_id: body.customerId,
              name: c.name ?? null,
              orgnr: c.orgnr ?? null,
              email: c.email ?? null,
              phone: c.phone ?? null,
              address: c.address ?? null,
              updated_at: new Date().toISOString()
            },
            { onConflict: "customer_id" }
          );
        if (upsertErr) {
          // logga, men blockera inte offertskapandet
          console.warn("customer_cards upsert failed:", upsertErr.message);
        }
      }
    } catch (e: any) {
      console.warn("customer_cards upsert exception:", e?.message);
    }

    // Belopp: använd amount, annars räkna från rader
    let amount = Number(body.amount);
    if (!isFinite(amount) || amount <= 0) {
      const computed = calcAmountFromData(data);
      if (isFinite(computed as number)) amount = computed as number;
    }
    if (!isFinite(amount)) amount = 0;

    const title = body.title ?? "Offert";
    const currency = String(body.currency ?? "SEK");
    const needs_print = Boolean(body.needsPrint ?? false);

    const pdfBytes = await createPdfFromOffer({ ...body, amount, title, currency, needsPrint: needs_print }, data);

    const offerId = crypto.randomUUID();
    const storageBucket = "paperflow-files";
    const storagePath = `customers/${body.customerId}/offers/${offerId}.pdf`;

    const { error: upErr } = await supabaseAdmin.storage
      .from(storageBucket)
      .upload(storagePath, pdfBytes, { contentType: "application/pdf", upsert: true });
    if (upErr) return bad(`Storage upload failed: ${upErr.message}`, 500);

    const { data: pub } = supabaseAdmin.storage.from(storageBucket).getPublicUrl(storagePath);
    const file_url = pub?.publicUrl;
    if (!file_url) return bad("Could not generate public URL", 500);

    const appOrigin = process.env.NEXT_PUBLIC_APP_ORIGIN || "http://localhost:3000";
    const customer_url = `${appOrigin}/kund/${encodeURIComponent(body.customerId)}`;

    const { data: inserted, error: insErr } = await supabaseAdmin
      .from("offers")
      .insert({
        id: offerId,
        customer_id: body.customerId,
        title,
        amount,
        currency,
        file_url,
        needs_print,
      })
      .select()
      .single();
    if (insErr) return bad(`DB insert failed: ${insErr.message}`, 500);

    return NextResponse.json({ ok: true, offer: { ...inserted, customer_url } }, { status: 200 });
  } catch (e: any) {
    return bad(e?.message ?? "Unknown error", 500);
  }
}
