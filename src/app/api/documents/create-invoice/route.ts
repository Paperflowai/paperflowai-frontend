import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import crypto from "crypto";

export const runtime = "nodejs";

type CreateInvoiceBody = {
  customerId: string;
};

function bad(msg: string, code = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status: code });
}

async function createInvoicePdf(invoiceData: any): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]); // A4
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontSize = 12;

  let y = 750;
  const lineHeight = 20;

  // Funktion för att lägga till text
  const addText = (text: string, x: number, yPos: number, size = fontSize) => {
    page.drawText(text, {
      x,
      y: yPos,
      size,
      font,
      color: rgb(0, 0, 0),
    });
  };

  // Titel
  addText("FAKTURA", 50, y, 18);
  y -= 40;

  // Kundinformation
  addText(`Kund: ${invoiceData.customer?.name || "Saknas"}`, 50, y);
  y -= lineHeight;
  addText(`Fakturadatum: ${new Date().toLocaleDateString('sv-SE')}`, 50, y);
  y -= lineHeight;
  addText(`Fakturanummer: ${invoiceData.invoiceNumber || "FAKT-" + Date.now()}`, 50, y);
  y -= lineHeight;
  addText(`Förfallodatum: ${invoiceData.dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('sv-SE')}`, 50, y);
  y -= 30;

  // Kunddetaljer
  addText("Faktureringsadress:", 50, y, 14);
  y -= lineHeight;
  addText(`${invoiceData.customer?.name || "Saknas"}`, 50, y);
  y -= lineHeight;
  addText(`${invoiceData.customer?.address || "Saknas"}`, 50, y);
  y -= lineHeight;
  addText(`${invoiceData.customer?.zip || ""} ${invoiceData.customer?.city || "Saknas"}`, 50, y);
  y -= lineHeight;
  addText(`Org.nr: ${invoiceData.customer?.orgnr || "Saknas"}`, 50, y);
  y -= 30;

  // Fakturadetaljer
  addText("Fakturadetaljer:", 50, y, 14);
  y -= lineHeight;
  addText(`Tjänst: ${invoiceData.title || "Saknas"}`, 50, y);
  y -= lineHeight;
  addText(`Belopp exkl. moms: ${invoiceData.amount || 0} ${invoiceData.currency || "SEK"}`, 50, y);
  y -= lineHeight;
  addText(`Moms (25%): ${(invoiceData.amount || 0) * 0.25} ${invoiceData.currency || "SEK"}`, 50, y);
  y -= lineHeight;
  addText(`Totalt inkl. moms: ${(invoiceData.amount || 0) * 1.25} ${invoiceData.currency || "SEK"}`, 50, y);
  y -= 30;

  // Betalningsvillkor
  addText("Betalningsvillkor:", 50, y, 14);
  y -= lineHeight;
  addText("Betaltid: 30 dagar", 50, y);
  y -= lineHeight;
  addText("Dröjsmålsränta: 8% enligt räntelagen", 50, y);
  y -= lineHeight;
  addText("Bankgiro: 123-4567", 50, y);
  y -= 30;

  // GDPR
  addText("GDPR:", 50, y, 14);
  y -= lineHeight;
  addText("Vi hanterar kunduppgifter enligt Dataskyddsförordningen (GDPR).", 50, y);

  return pdfDoc.save();
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as CreateInvoiceBody;
    const { customerId } = body;

    if (!customerId) {
      return bad("Missing required field: customerId");
    }

    // Hämta senaste order för kunden
    const { data: orderData, error: orderError } = await supabaseAdmin
      .from("documents")
      .select("*")
      .eq("customer_id", customerId)
      .eq("type", "order")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (orderError || !orderData) {
      return bad("Orderbekräftelse hittades inte");
    }

    // Skapa faktura-data
    const invoiceData = {
      invoiceNumber: `FAKT-${new Date().getFullYear()}-${Math.floor(Math.random() * 9999).toString().padStart(4, '0')}`,
      customer: orderData.data_json?.customer || {},
      title: orderData.title,
      amount: orderData.amount,
      currency: orderData.currency,
      orderId: orderId,
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    };

    // Skapa PDF
    const pdfBytes = await createInvoicePdf(invoiceData);

    // Ladda upp PDF till Supabase Storage
    const fileName = `invoice-${invoiceData.invoiceNumber}.pdf`;
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from("documents")
      .upload(fileName, pdfBytes, {
        contentType: "application/pdf",
        upsert: true
      });

    if (uploadError) {
      console.error("PDF upload error:", uploadError);
      return bad("Kunde inte ladda upp PDF");
    }

    // Hämta PDF URL
    const { data: urlData } = supabaseAdmin.storage
      .from("documents")
      .getPublicUrl(fileName);

    // Spara faktura i databasen
    const invoiceId = crypto.randomUUID();
    const { data: invoiceDoc, error: invoiceError } = await supabaseAdmin
      .from("documents")
      .insert({
        id: invoiceId,
        customer_id: customerId,
        type: "faktura",
        title: `Faktura - ${invoiceData.title}`,
        amount: invoiceData.amount,
        currency: invoiceData.currency,
        data_json: invoiceData,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (invoiceError) {
      console.error("Invoice creation error:", invoiceError);
      return bad("Kunde inte skapa faktura");
    }

    return NextResponse.json({
      ok: true,
      invoice: invoiceDoc,
      pdfUrl: urlData.publicUrl,
      message: "Faktura skapad framgångsrikt"
    });

  } catch (error) {
    console.error("Invoice creation error:", error);
    return bad(`Server error: ${error instanceof Error ? error.message : String(error)}`);
  }
}
