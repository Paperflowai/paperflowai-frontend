import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";
import crypto from "crypto";
import { buildDocument } from "@/lib/pdf/buildDocument";

export const runtime = "nodejs";

type GPTOfferBody = {
  customerId: string;
  jsonData?: any;     // valfritt – extra strukturerad data från GPT
  textData: string;   // själva offerttexten
};

function bad(msg: string, code = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status: code });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as GPTOfferBody;
    const { customerId, jsonData, textData } = body;

    // Enda hårda kraven: kund-id + texten
    if (!customerId || !textData) {
      return bad("Missing customerId or textData");
    }

    // Gör jsonData säkert valfritt
    const safeJson = jsonData || {};
    const kund = safeJson.kund || {};

    // 1) Upsert kund i public.customers (autofyll kundkortet så gott det går)
    await supabaseAdmin.from("customers").upsert(
      {
        id: customerId,
        name: kund.namn || null,
        orgnr: kund.orgnr || null,
        email: kund.epost || null,
        phone: kund.telefon || null,
        address: kund.adress || null,
        zip: kund.postnummer || null,
        city: kund.ort || null,
        country: kund.land || "Sverige",
      },
      { onConflict: "id" }
    );

    // 2) Generera PDF från texten
    const pdfBytes = await buildDocument(
      {
        customerId,
        title: safeJson.titel || "Offert",
        amount: safeJson.summa || 0,
        currency: safeJson.valuta || "SEK",
        needsPrint: false,
        data: {
          textData,      // <- används av vår enkla PDF-layout
        },
      },
      "offer"
    );

    // 3) Lagra PDF i Supabase Storage
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

    // 4) Spara rad i public.documents (så den syns under “Alla dokument”)
    const { error: docErr } = await supabaseAdmin.from("documents").insert({
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
    });

    if (docErr) {
      return bad("Insert into documents failed: " + docErr.message, 500);
    }

    // 5) Skapa offert-rad i public.offers (samma typ som /api/offers/route.ts)
    const offerPayload = {
      ...safeJson,
      customerId,
      textData,
      pdfUrl: pub.publicUrl,
      documentId: docId,
    };

    const { error: offerErr } = await supabaseAdmin
      .from("offers")
      .insert({
        status: safeJson.status ?? "sent", // "draft" / "sent" / "accepted" / ...
        data: offerPayload,                // sparar hela objektet i jsonb
      });

    if (offerErr) {
      console.error("❌ create-from-gpt: offers insert failed:", offerErr.message);
      // vi låter ändå PDF:en vara skapad – därför bara logg, inte 500-fel
    }

    // 6) Svar tillbaka till GPT / klienten
    return NextResponse.json(
      {
        ok: true,
        id: docId,
        pdfUrl: pub.publicUrl,
      },
      { status: 200 }
    );
  } catch (e: any) {
    console.error("❌ create-from-gpt error:", e);
    return bad(e?.message || "Unknown error", 500);
  }
}
