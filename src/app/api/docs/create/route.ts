import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { z } from "zod";

export const runtime = "nodejs";

// Prefer central admin client for consistent server-side privileges
const supabase = supabaseAdmin;

const CustomerSchema = z.object({
  id: z.string().min(1).optional(),
  name: z.string().optional(),
  orgnr: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  zip: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
});

const BaseDocSchema = z.object({
  document_type: z.enum(["offer", "receipt"]),
  customer: CustomerSchema.optional(),
  filePath: z.string().optional(),
});

const OfferSchema = BaseDocSchema.extend({
  document_type: z.literal("offer"),
  customerId: z.string().min(1),
  title: z.string().min(1),
  amount: z.number().nonnegative(),
  currency: z.string().min(1),
  dataJson: z.union([z.string(), z.record(z.any())]).optional(),
});

const ReceiptSchema = BaseDocSchema.extend({
  document_type: z.literal("receipt"),
  date: z.string().optional(),
  amount: z.number().optional(),
  vat: z.number().optional(),
  currency: z.string().optional(),
});

const BodySchema = z.discriminatedUnion("document_type", [OfferSchema, ReceiptSchema]);

function toObject(value: unknown): Record<string, any> | undefined {
  if (!value) return undefined;
  if (typeof value === "string") {
    try { return JSON.parse(value); } catch { return undefined; }
  }
  if (typeof value === "object") return value as Record<string, any>;
  return undefined;
}

function extractCustomerFromDataJson(dataJson: unknown) {
  const d = toObject(dataJson);
  if (!d) return undefined;
  const kund = d.kund || d.customer || {};
  const foretag = d.foretag || d.company || {};
  return {
    name: kund.namn ?? kund.name ?? foretag.namn ?? foretag.name ?? undefined,
    orgnr: kund.orgnr ?? foretag.orgnr ?? undefined,
    email: kund.epost ?? kund.email ?? foretag.epost ?? foretag.email ?? undefined,
    phone: kund.telefon ?? kund.phone ?? foretag.telefon ?? foretag.phone ?? undefined,
    address: kund.adress ?? kund.address ?? foretag.adress ?? foretag.address ?? undefined,
    zip: kund.postnummer ?? kund.zip ?? undefined,
    city: kund.ort ?? kund.city ?? undefined,
    country: kund.land ?? kund.country ?? "Sverige",
  } as const;
}

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const parsed = BodySchema.parse(json);

    // Build customer upsert from explicit customer block or from dataJson
    const fromData = extractCustomerFromDataJson((parsed as any).dataJson);
    const c = parsed.customer || (fromData as any);
    const upsertCustomer = c
      ? {
          id: (parsed as any).customerId ?? c.id ?? undefined,
          name: c.name ?? null,
          orgnr: c.orgnr ?? null,
          email: c.email ?? null,
          phone: c.phone ?? null,
          address: c.address ?? null,
          zip: c.zip ?? null,
          city: c.city ?? null,
          country: c.country ?? "Sverige",
        }
      : undefined;

    if (upsertCustomer?.id) {
      const { error: custErr } = await supabase
        .from("customers")
        .upsert(upsertCustomer as any, { onConflict: "id" });
      if (custErr) {
        console.error("customers upsert error:", custErr);
        return NextResponse.json({ ok: false, error: "Failed to upsert customer" }, { status: 500 });
      }
    }

    if (parsed.document_type === "offer") {
      const dataJsonString =
        typeof parsed.dataJson === "string" ? parsed.dataJson : JSON.stringify(parsed.dataJson ?? {});

      const insertOffer = {
        customer_id: parsed.customerId,
        title: parsed.title,
        amount: parsed.amount,
        currency: parsed.currency,
        data_json: dataJsonString,
        created_at: new Date().toISOString(),
      } as any;

      const { data: offerRow, error: offerErr } = await supabase
        .from("offers")
        .insert(insertOffer)
        .select("id, customer_id, title, amount, currency, created_at")
        .single();

      if (offerErr) {
        console.error("offers insert error:", offerErr);
        return NextResponse.json({ ok: false, error: "Failed to create offer" }, { status: 500 });
      }

      return NextResponse.json({ ok: true, type: "offer", offer: offerRow }, { status: 201 });
    }

    if (parsed.document_type === "receipt") {
      const insertReceipt = {
        file_path: parsed.filePath ?? null,
        date: parsed.date ?? null,
        amount: parsed.amount ?? null,
        vat: parsed.vat ?? null,
        currency: parsed.currency ?? "SEK",
        created_at: new Date().toISOString(),
      } as any;

      const { data: receiptRow, error: recErr } = await supabase
        .from("receipts")
        .insert(insertReceipt)
        .select("*")
        .single();

      if (recErr) {
        console.error("receipts insert error:", recErr);
        return NextResponse.json({ ok: false, error: "Failed to create receipt" }, { status: 500 });
      }

      return NextResponse.json({ ok: true, type: "receipt", receipt: receiptRow }, { status: 201 });
    }

    return NextResponse.json({ ok: false, error: "Unsupported document_type" }, { status: 400 });
  } catch (e: any) {
    console.error("docs/create error:", e);
    if (e?.issues) {
      return NextResponse.json({ ok: false, error: "Invalid body", details: e.issues }, { status: 400 });
    }
    return NextResponse.json({ ok: false, error: "Unexpected error" }, { status: 500 });
  }
}


