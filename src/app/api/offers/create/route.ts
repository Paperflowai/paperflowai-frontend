// src/app/api/offers/create/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import crypto from "crypto";

export const runtime = "nodejs";

type OfferBody = {
  customerId: string;
  title?: string;
  amount?: number;
  currency?: string;       // default "SEK"
  needsPrint?: boolean;    // default false
  data?: any;              // valfritt objekt
  dataJson?: string;       // NYTT: stringifierad offertdata
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
  } catch {
    return undefined;
  }
}

async function createPdfFromOffer(body: OfferBody): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]); // A4
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const marginX = 50;
  let y = 800;

  const draw = (text: string, bold = false, size = 12, color = rgb(0, 0, 0)) => {
    const usedFont = bold ? fontBold : font;
    page.drawText(String(text), { x: marginX, y, size, font: usedFont, color });
    y -= size + 8;
  };

  // Header
  draw("OFFERT", true, 20);
  draw(new Date().toLocaleString(), false, 10, rgb(0.4, 0.4, 0.4));
  y -= 6;

  // Grunddata
  draw(`Kundkort / Customer ID: ${body.customerId}`, false, 12);
  draw(`Titel: ${body.title ?? "Offert"}`, false, 12);
  draw(`Belopp: ${String(body.amount ?? 0)} ${body.currency ?? "SEK"}`, false, 12);
  draw(`Markerad för papperskopia: ${Boolean(body.needsPrint ?? false) ? "Ja" : "Nej"}`, false, 12);

  y -= 10;
  draw("Sammanfattning av data:", true, 12);

  // Lista några nycklar från data
  try {
    const clone = JSON.parse(JSON.stringify(body.data ?? {}));
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

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as OfferBody;

    // 1) Validering
    if (!body?.customerId) return bad("Missing 'customerId'");

    // 2) Mappa data/dataJson → body.data
    const parsed = safeParse(body.dataJson);
    if (body.data == null && parsed) {
      body.data = parsed;
    } else if (body.data && parsed && typeof parsed === "object") {
      body.data = { ...parsed, ...body.data };
    } else if (body.data == null) {
      body.data = { summary: "Ingen strukturerad offertdata skickades." };
    }

    // 3) Beräkna belopp om saknas/ogiltigt
    let amount = Number(body.amount);
    if (!isFinite(amount) || amount <= 0) {
      const computed = calcAmountFromData(body.data);
      if (isFinite(computed as number)) amount = computed as number;
    }
    if (!isFinite(amount)) amount = 0;

    const title = body.title ?? "Offert";
    const currency = String(body.currency ?? "SEK");
    const needs_print = Boolean(body.needsPrint ?? false);

    // 4) Skapa PDF
    const pdfBytes = await createPdfFromOffer({ ...body, amount });

    // 5) Storage-path
    const offerId = crypto.randomUUID();
    const storageBucket = "paperflow-files"; // Public bucket i Supabase
    const storagePath = `customers/${body.customerId}/offers/${offerId}.pdf`;

    // 6) Ladda upp PDF
    const { error: upErr } = await supabaseAdmin.storage
      .from(storageBucket)
      .upload(storagePath, pdfBytes, { contentType: "application/pdf", upsert: true });
    if (upErr) return bad(`Storage upload failed: ${upErr.message}`, 500);

    // 7) Public URL
    const { data: pub } = supabaseAdmin.storage.from(storageBucket).getPublicUrl(storagePath);
    const file_url = pub?.publicUrl;
    if (!file_url) return bad("Could not generate public URL", 500);

    // 8) Spara i DB
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

    // 9) Svar
    return NextResponse.json({ ok: true, offer: inserted }, { status: 200 });
  } catch (e: any) {
    return bad(e?.message ?? "Unknown error", 500);
  }
}