// src/app/api/offers/create/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import crypto from "crypto";

export const runtime = "nodejs";

// --- Kund-upsert typer + helpers ---
type CustomerUpsert = {
  id: string;
  name?: string | null;
  orgnr?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  zip?: string | null;
  city?: string | null;
  country?: string | null;
};

function toObj(v: any) {
  if (!v) return {};
  if (typeof v === "string") {
    try { return JSON.parse(v); } catch { return {}; }
  }
  return v;
}

function extractCustomer(customerId: string, maybeData: any): CustomerUpsert {
  const d = toObj(maybeData);
  const c = d.customer || d.kund || d.client || {};

  const name    = c.name || c.namn || d.name || d.namn || null;
  const orgnr   = c.orgnr || c.orgnummer || null;
  const email   = c.email || c.epost || c.e_post || c.mail || d.email || d.epost || null;
  const phone   = c.phone || c.telefon || c.telefonnummer || d.phone || d.telefon || null;
  const address = c.address || c.adress || d.address || d.adress || null;
  const zip     = c.zip || c.postnummer || c.postnr || null;
  const city    = c.city || c.ort || null;
  const country = c.country || c.land || "Sverige";

  return { id: customerId, name, orgnr, email, phone, address, zip, city, country };
}

type OfferBody = {
  customerId: string;
  title?: string;
  amount?: number;
  currency?: string;       // default "SEK"
  needsPrint?: boolean;    // default false
  data?: any;              // tillåt båda
  dataJson?: any;          // tillåt båda
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

import { buildDocument } from '@/lib/pdf/buildDocument';

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as OfferBody;

    // 1) Minikrav
    if (!body?.customerId) return bad("Missing 'customerId'");

    // 2.x) Upsert kund i public.customers (fortsätt även om det felar)
    try {
      const customerPayload = extractCustomer(body.customerId, body.dataJson ?? body.data);
      if (customerPayload?.id) {
        const { error: custErr } = await supabaseAdmin
          .from("customers")
          .upsert(customerPayload, { onConflict: "id" });
        if (custErr) {
          console.warn("customers upsert failed:", custErr.message);
        }
      }
    } catch (e:any) {
      console.warn("customers upsert exception:", e?.message || e);
    }

    // 2) Mappa dataJson → data (om skickad)
    const parsed = safeParse(body.dataJson);
    if (body.data == null && parsed) {
      body.data = parsed;
    } else if (body.data && parsed && typeof parsed === "object") {
      body.data = { ...parsed, ...body.data };
    } else if (body.data == null && !body.dataJson) {
      body.data = { summary: "Ingen strukturerad offertdata skickades." };
    } else if (body.dataJson && !parsed) {
      return bad("Invalid dataJson format - must be valid JSON string");
    }

    // 3) Auto-summa om belopp saknas
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
    const pdfBytes = await buildDocument({ ...body, amount }, 'offer');

    // 5) Storage-path
    const offerId = crypto.randomUUID();
    const storageBucket = "paperflow-files";
    const storagePath = `customers/${body.customerId}/offers/${offerId}.pdf`;

    // 6) Upload
    const { error: upErr } = await supabaseAdmin.storage
      .from(storageBucket)
      .upload(storagePath, pdfBytes, { contentType: "application/pdf", upsert: true });
    if (upErr) return bad(`Storage upload failed: ${upErr.message}`, 500);

    // 7) Public URL
    const { data: pub } = supabaseAdmin.storage.from(storageBucket).getPublicUrl(storagePath);
    const file_url = pub?.publicUrl;
    if (!file_url) return bad("Could not generate public URL", 500);

    const appOrigin = process.env.NEXT_PUBLIC_APP_ORIGIN || "http://localhost:3000";
    const customer_url = `${appOrigin}/kund/${encodeURIComponent(body.customerId)}`;

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
        status: null, // Ingen status initialt
      })
      .select()
      .single();
    if (insErr) return bad(`DB insert failed: ${insErr.message}`, 500);

    // 9) Svar
    return NextResponse.json(
      { ok: true, offer: { ...inserted, customer_url } },
      { status: 200 }
    );
  } catch (e: any) {
    return bad(e?.message ?? "Unknown error", 500);
  }
}