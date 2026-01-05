import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";
import crypto from "crypto";
import { buildDocument } from "@/lib/pdf/buildDocument";

export const runtime = "nodejs";

type GPTOfferBody = {
  customerId?: string;
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

    if (!textData) return bad("Missing textData");

    const safeJson = jsonData || {};
    const kund = safeJson.kund || safeJson.customer || {};

    const companyName =
      kund.namn ??
      kund.name ??
      kund.foretag ??
      kund.company ??
      safeJson.kundnamn ??
      safeJson.foretag ??
      safeJson.company ??
      "Ny kund";

    const contactPerson =
      kund.kontaktperson ??
      kund.contactperson ??
      kund.contactPerson ??
      null;

    const email = kund.epost ?? kund.email ?? null;
    const phone = kund.telefon ?? kund.phone ?? null;
    const address = kund.adress ?? kund.address ?? null;
    const zip = kund.postnummer ?? kund.postnr ?? kund.zip ?? null;
    const city = kund.ort ?? kund.city ?? kund.stad ?? null;
    const orgNr = kund.orgnr ?? kund.org_nr ?? null;

    if (!customerId) customerId = crypto.randomUUID();

    // 1️⃣ Skapa / uppdatera kund
    const customerRow = {
      id: customerId,
      name: companyName,
      company_name: companyName,
      org_nr: orgNr,
      email,
      phone,
      address,
      zip,
      city,
      country: "Sverige",
      updated_at: new Date().toISOString(),
    };

    const { error: customerError } = await supabaseAdmin
      .from("customers")
      .upsert(customerRow, { onConflict: "id" });

    if (customerError) {
      return bad("Customer upsert failed: " + customerError.message, 500);
    }

    // 2️⃣ AUTO-UPPDATERA KUNDNAMN VIA PATCH (OM PLACEHOLDER)
    if (["Ny kund", "OKÄNT FÖRETAG", "Namnlös kund"].includes(companyName)) {
      try {
        await fetch(
          `${process.env.NEXT_PUBLIC_BASE_URL}/api/customers/${customerId}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              company_name: companyName,
            }),
          }
        );
      } catch {
        // helt tyst – detta är safe
      }
    }

    // 3️⃣ Skapa PDF
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

    const docId = crypto.randomUUID();
    const bucket = "paperflow-files";
    const storagePath = `documents/${customerId}/offers/${docId}.pdf`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from(bucket)
      .upload(storagePath, pdfBytes, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadError) {
      return bad("Upload failed: " + uploadError.message, 500);
    }

    const { data: pub } = supabaseAdmin.storage
      .from(bucket)
      .getPublicUrl(storagePath);

    if (!pub?.publicUrl) {
      return bad("Could not generate public URL", 500);
    }

    // 4️⃣ Spara offert
    const { data: offerRow, error: offerErr } = await supabaseAdmin
      .from("offers")
      .insert({
        customer_id: customerId,
        status: "created",
        data: safeJson,
        created_at: new Date().toISOString(),
        file_url: pub.publicUrl,
        payload: { textData },
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
        offerId: offerRow.id,
        pdfUrl: pub.publicUrl,
      },
      { status: 200 }
    );
  } catch (e: any) {
    return bad(e?.message || "Unknown error", 500);
  }
}
