import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";
import crypto from "crypto";
import { buildDocument } from "@/lib/pdf/buildDocument";

export const runtime = "nodejs";

type GPTOfferBody = {
  customerId?: string;      // kan saknas vid ny kund
  jsonData?: any;
  textData: string;
};

function bad(msg: string, code = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status: code });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as GPTOfferBody;
    let { customerId, jsonData, textData } = body;

    if (!textData) {
      return bad("Missing textData");
    }

    const safeJson = jsonData || {};
    const kund = safeJson.kund || {};

    // 1) Sätt kund-ID
    if (!customerId) {
      // Ny kund → skapa id
      customerId = crypto.randomUUID();
    }

    // 2) Upsert i public.customers (det är den dashboarden läser från)
    await supabaseAdmin.from("customers").upsert(
      {
        id: customerId,
        name: kund.namn || safeJson.kundnamn || "Ny kund",
        orgnr: kund.orgnr || null,
        email: kund.epost || kund.email || null,
        phone: kund.telefon || null,
        address: kund.adress || null,
        zip: kund.postnummer || null,
        city: kund.ort || null,
        country: kund.land || "Sverige",
      },
      { onConflict: "id" }
    );

    // 3) Spegla till public.customer_cards (för framtida logik)
    await supabaseAdmin.from("customer_cards").upsert(
      {
        customer_id: customerId,
        name: kund.namn || safeJson.kundnamn || "Ny kund",
        orgnr: kund.orgnr || null,
        email: kund.epost || kund.email || null,
        phone: kund.telefon || null,
        address: kund.adress || null,
      },
      { onConflict: "customer_id" }
    );

    // 4) Generera PDF
    const pdfBytes = await buildDocument(
      {
        customerId,
        title: safeJson.titel || "Offert",
        amount: safeJson.summa || 0,
        currency: safeJson.valuta || "SEK",
        needsPrint: false,
        data: { textData },
      },
      "offer"
    );

    // 5) Lagra PDF i Storage
    const docId = crypto.randomUUID();
    const bucket = "paperflow-files";
    const storagePath = `documents/${customerId}/offers/${docId}.pdf`;

    const { error: upErr } = await supabaseAdmin.storage
      .from(bucket)
      .upload(storagePath, pdfBytes, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (upErr) {
      return bad("Upload failed: " + upErr.message, 500);
    }

    const { data: pub } = supabaseAdmin.storage
      .from(bucket)
      .getPublicUrl(storagePath);

    if (!pub?.publicUrl) {
      return bad("Could not generate public URL", 500);
    }

    // 6) Spara rad i documents
    const { data: docRow, error: docErr } = await supabaseAdmin
      .from("documents")
      .insert({
        id: docId,
        customer_id: customerId,
        doc_type: "offer",
        type: "offer",
        filename: safeJson.titel || "Offert",
        storage_path: storagePath,
        file_url: pub.publicUrl,
        bucket,
        bucket_name: bucket,
        status: "created",
        created_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (docErr) {
      return bad("Insert failed: " + docErr.message, 500);
    }

    // 7) Spara själva offern i offers-tabellen (enkel variant)
    const { data: offerRow, error: offerErr } = await supabaseAdmin
      .from("offers")
      .insert({
        customer_id: customerId,
        status: "created",
        data: safeJson,
        created_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (offerErr) {
      return bad("Offer insert failed: " + offerErr.message, 500);
    }

    return NextResponse.json(
      {
        ok: true,
        customerId,
        documentId: docRow.id,
        offerId: offerRow.id,
        pdfUrl: pub.publicUrl,
      },
      { status: 200 }
    );
  } catch (e: any) {
    console.error("create-from-gpt error:", e);
    return bad(e?.message || "Unknown error", 500);
  }
}
