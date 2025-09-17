import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

type OrderConfirmationBody = {
  offerId: string;
  customerId: string;
};

function bad(msg: string, code = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status: code });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as OrderConfirmationBody;
    if (!body?.offerId) return bad("Missing offerId");
    if (!body?.customerId) return bad("Missing customerId");

    // Hämta offertdata från databasen
    const { data: offer, error: offerError } = await supabaseAdmin
      .from("offers")
      .select("*")
      .eq("id", body.offerId)
      .eq("customer_id", body.customerId)
      .single();

    if (offerError || !offer) {
      return bad("Offert not found", 404);
    }

    // Hämta kunddata från databasen
    const { data: customer, error: customerError } = await supabaseAdmin
      .from("customers")
      .select("*")
      .eq("id", body.customerId)
      .single();

    if (customerError || !customer) {
      return bad("Customer not found", 404);
    }

    // Skapa PDF för orderbekräftelse
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595.28, 841.89]); // A4
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const { width, height } = page.getSize();
    let yPosition = height - 50;

    // Titel
    page.drawText("ORDERBEKRÄFTELSE", {
      x: 50,
      y: yPosition,
      size: 20,
      font: boldFont,
      color: rgb(0, 0, 0),
    });
    yPosition -= 40;

    // Kundinformation
    page.drawText("Kundinformation:", {
      x: 50,
      y: yPosition,
      size: 14,
      font: boldFont,
      color: rgb(0, 0, 0),
    });
    yPosition -= 20;

    page.drawText(`Företag: ${customer.name}`, {
      x: 50,
      y: yPosition,
      size: 12,
      font: font,
      color: rgb(0, 0, 0),
    });
    yPosition -= 15;

    if (customer.orgnr) {
      page.drawText(`Org.nr: ${customer.orgnr}`, {
        x: 50,
        y: yPosition,
        size: 12,
        font: font,
        color: rgb(0, 0, 0),
      });
      yPosition -= 15;
    }

    if (customer.address) {
      page.drawText(`Adress: ${customer.address}`, {
        x: 50,
        y: yPosition,
        size: 12,
        font: font,
        color: rgb(0, 0, 0),
      });
      yPosition -= 15;
    }

    if (customer.email) {
      page.drawText(`E-post: ${customer.email}`, {
        x: 50,
        y: yPosition,
        size: 12,
        font: font,
        color: rgb(0, 0, 0),
      });
      yPosition -= 15;
    }

    yPosition -= 20;

    // Orderinformation
    page.drawText("Orderinformation:", {
      x: 50,
      y: yPosition,
      size: 14,
      font: boldFont,
      color: rgb(0, 0, 0),
    });
    yPosition -= 20;

    page.drawText(`Offert: ${offer.title || "Offert"}`, {
      x: 50,
      y: yPosition,
      size: 12,
      font: font,
      color: rgb(0, 0, 0),
    });
    yPosition -= 15;

    page.drawText(`Belopp: ${offer.amount || 0} ${offer.currency || "SEK"}`, {
      x: 50,
      y: yPosition,
      size: 12,
      font: font,
      color: rgb(0, 0, 0),
    });
    yPosition -= 15;

    page.drawText(`Datum: ${new Date().toLocaleDateString("sv-SE")}`, {
      x: 50,
      y: yPosition,
      size: 12,
      font: font,
      color: rgb(0, 0, 0),
    });
    yPosition -= 30;

    // Bekräftelsetext
    page.drawText("Vi bekräftar härmed att vi tagit emot er order enligt ovanstående offert.", {
      x: 50,
      y: yPosition,
      size: 12,
      font: font,
      color: rgb(0, 0, 0),
    });
    yPosition -= 20;

    page.drawText("Orderbekräftelsen skickas automatiskt till er e-postadress.", {
      x: 50,
      y: yPosition,
      size: 12,
      font: font,
      color: rgb(0, 0, 0),
    });

    // Generera PDF
    const pdfBytes = await pdfDoc.save();

    // Ladda upp till Supabase Storage
    const bucket = "paperflow-files";
    const fileName = `order-confirmation-${body.offerId}.pdf`;
    const storagePath = `customers/${body.customerId}/orders/${fileName}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from(bucket)
      .upload(storagePath, pdfBytes, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadError) {
      return bad(`Storage upload failed: ${uploadError.message}`, 500);
    }

    // Hämta public URL
    const { data: urlData } = supabaseAdmin.storage
      .from(bucket)
      .getPublicUrl(storagePath);

    // Uppdatera offertens status i databasen (lägg till status kolumn om den inte finns)
    const { error: updateError } = await supabaseAdmin
      .from("offers")
      .update({ status: "order_confirmed" })
      .eq("id", body.offerId)
      .eq("customer_id", body.customerId);

    if (updateError) {
      return bad(`Status update failed: ${updateError.message}`, 500);
    }

    return NextResponse.json(
      { 
        ok: true, 
        orderConfirmation: {
          id: `order-${body.offerId}`,
          file_url: urlData.publicUrl,
          created_at: new Date().toISOString(),
        }
      }, 
      { status: 200 }
    );
  } catch (e: any) {
    return bad(e?.message ?? "Unknown error", 500);
  }
}
