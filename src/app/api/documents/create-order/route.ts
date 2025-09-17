import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import crypto from "crypto";

export const runtime = "nodejs";

type CreateOrderBody = {
  customerId: string;
};

function bad(msg: string, code = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status: code });
}

async function createOrderPdf(orderData: any): Promise<Uint8Array> {
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
  addText("ORDERBEKRÄFTELSE", 50, y, 18);
  y -= 40;

  // Kundinformation
  addText(`Kund: ${orderData.customer?.name || "Saknas"}`, 50, y);
  y -= lineHeight;
  addText(`Datum: ${new Date().toLocaleDateString('sv-SE')}`, 50, y);
  y -= lineHeight;
  addText(`Ordernummer: ${orderData.orderNumber || "ORD-" + Date.now()}`, 50, y);
  y -= 30;

  // Kunddetaljer
  addText("Kundinformation:", 50, y, 14);
  y -= lineHeight;
  addText(`Org.nr: ${orderData.customer?.orgnr || "Saknas"}`, 50, y);
  y -= lineHeight;
  addText(`Adress: ${orderData.customer?.address || "Saknas"}`, 50, y);
  y -= lineHeight;
  addText(`Kontaktperson: ${orderData.customer?.contactPerson || "Saknas"}`, 50, y);
  y -= lineHeight;
  addText(`Telefon: ${orderData.customer?.phone || "Saknas"}`, 50, y);
  y -= lineHeight;
  addText(`E-post: ${orderData.customer?.email || "Saknas"}`, 50, y);
  y -= 30;

  // Orderdetaljer
  addText("Orderdetaljer:", 50, y, 14);
  y -= lineHeight;
  addText(`Tjänst: ${orderData.title || "Saknas"}`, 50, y);
  y -= lineHeight;
  addText(`Belopp: ${orderData.amount || 0} ${orderData.currency || "SEK"}`, 50, y);
  y -= 30;

  // Leveransvillkor
  addText("Leveransvillkor:", 50, y, 14);
  y -= lineHeight;
  addText("Leveranstid: Enligt överenskommelse", 50, y);
  y -= lineHeight;
  addText("Betalningsvillkor: 30 dagar", 50, y);
  y -= 30;

  // Signatur
  addText("Signatur:", 50, y, 14);
  y -= lineHeight;
  addText("[Namn och e-post på undertecknare]", 50, y);

  return pdfDoc.save();
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as CreateOrderBody;
    const { customerId } = body;

    if (!customerId) {
      return bad("Missing required field: customerId");
    }

    // Hämta senaste offert för kunden
    const { data: offerData, error: offerError } = await supabaseAdmin
      .from("documents")
      .select("*")
      .eq("customer_id", customerId)
      .eq("type", "offert")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (offerError || !offerData) {
      return bad("Offert hittades inte");
    }

    // Skapa orderbekräftelse-data
    const orderData = {
      orderNumber: `ORD-${new Date().getFullYear()}-${Math.floor(Math.random() * 9999).toString().padStart(4, '0')}`,
      customer: offerData.data_json?.kund || {},
      title: offerData.title,
      amount: offerData.amount,
      currency: offerData.currency,
      offerId: offerId
    };

    // Skapa PDF
    const pdfBytes = await createOrderPdf(orderData);

    // Ladda upp PDF till Supabase Storage
    const fileName = `order-${orderData.orderNumber}.pdf`;
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

    // Spara orderbekräftelse i databasen
    const orderId = crypto.randomUUID();
    const { data: orderDoc, error: orderError } = await supabaseAdmin
      .from("documents")
      .insert({
        id: orderId,
        customer_id: customerId,
        type: "order",
        title: `Orderbekräftelse - ${orderData.title}`,
        amount: orderData.amount,
        currency: orderData.currency,
        data_json: orderData,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (orderError) {
      console.error("Order creation error:", orderError);
      return bad("Kunde inte skapa orderbekräftelse");
    }

    return NextResponse.json({
      ok: true,
      order: orderDoc,
      pdfUrl: urlData.publicUrl,
      message: "Orderbekräftelse skapad framgångsrikt"
    });

  } catch (error) {
    console.error("Order creation error:", error);
    return bad(`Server error: ${error instanceof Error ? error.message : String(error)}`);
  }
}
