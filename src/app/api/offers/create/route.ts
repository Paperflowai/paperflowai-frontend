import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import crypto from "crypto";

type OfferBody = {
  customerId: string;
  title?: string;
  amount?: number;
  currency?: string;      // default "SEK"
  needsPrint?: boolean;   // default false
  data: any;              // hela offertdatan (kund, rader, villkor, mm.)
};

function bad(msg: string, code = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status: code });
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
  draw(new Date().toLocaleString(), false, 10, rgb(0.4,0.4,0.4));
  y -= 6;

  // Grunddata
  draw(`Kundkort / Customer ID: ${body.customerId}`, false, 12);
  draw(`Titel: ${body.title ?? "Offert"}`, false, 12);
  draw(`Belopp: ${String(body.amount ?? 0)} ${body.currency ?? "SEK"}`, false, 12);
  draw(`Markerad för papperskopia: ${Boolean(body.needsPrint ?? false) ? "Ja" : "Nej"}`, false, 12);

  y -= 10;
  draw("Sammanfattning av data:", true, 12);

  // Skriv ut några nycklar från data
  try {
    const clone = JSON.parse(JSON.stringify(body.data ?? {}));
    const keys = Object.keys(clone).slice(0, 12);
    for (const k of keys) {
      if (y < 60) break;
      const v = typeof clone[k] === "object" ? JSON.stringify(clone[k]) : String(clone[k]);
      const line = `${k}: ${v}`.slice(0, 110); // klipp långa rader
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
    if (typeof body.data === "undefined") return bad("Missing 'data'");

    const title = body.title ?? "Offert";
    const amount = Number(body.amount ?? 0);
    const currency = String(body.currency ?? "SEK");
    const needs_print = Boolean(body.needsPrint ?? false);

    // 2) Skapa PDF
    const pdfBytes = await createPdfFromOffer(body);

    // 3) Storage-path
    const offerId = crypto.randomUUID();
    const storageBucket = "paperflow-files"; // kontrollera att bucketen är Public i Supabase
    const storagePath = `customers/${body.customerId}/offers/${offerId}.pdf`;

    // 4) Ladda upp till Supabase Storage
    const { error: upErr } = await supabaseAdmin
      .storage
      .from(storageBucket)
      .upload(storagePath, pdfBytes, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (upErr) return bad(`Storage upload failed: ${upErr.message}`, 500);

    // 5) Public URL
    const { data: pub } = supabaseAdmin.storage.from(storageBucket).getPublicUrl(storagePath);
    const file_url = pub?.publicUrl;
    if (!file_url) return bad("Could not generate public URL", 500);

    // 6) Insert i DB
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

    // 7) Svar
    return NextResponse.json({ ok: true, offer: inserted }, { status: 200 });
  } catch (e: any) {
    return bad(e?.message ?? "Unknown error", 500);
  }
}
