export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { supabaseAdmin as admin } from "@/lib/supabaseServer";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

function json(data: any, status = 200) {
  return NextResponse.json(data, { status });
}

// ✅ Enkel ping för att testa i browsern
export async function GET() {
  return json({ ok: true, ping: "orders/create-from-offer" });
}

/** ——— Stämpel-inställningar för ORDER ——— */
const STAMP_ON = true;
const STAMP_Y = 615;
const STAMP_HEIGHT = 38;
const STAMP_LEFT = 76;
const STAMP_RIGHT = 60;
const STAMP_TEXT = "ORDERBEKRÄFTELSE";
const STAMP_SIZE = 18;

async function stampOrderHeader(src: Uint8Array): Promise<Uint8Array> {
  if (!STAMP_ON) return src;

  const doc = await PDFDocument.load(src);
  const pages = doc.getPages();
  if (!pages.length) return src;

  const page = pages[0];
  const { width } = page.getSize();
  const helvBold = await doc.embedFont(StandardFonts.HelveticaBold);

  // Vit banderoll över gamla rubriken
  page.drawRectangle({
    x: STAMP_LEFT,
    y: STAMP_Y - 6,
    width: width - (STAMP_LEFT + STAMP_RIGHT),
    height: STAMP_HEIGHT,
    color: rgb(1, 1, 1),
  });

  // Ny rubrik: ORDERBEKRÄFTELSE
  page.drawText(STAMP_TEXT, {
    x: STAMP_LEFT,
    y: STAMP_Y,
    size: STAMP_SIZE,
    font: helvBold,
    color: rgb(0, 0, 0),
  });

  return doc.save();
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as any;

    const customerId: string | undefined = body?.customerId;
    const offerPath: string | undefined = body?.offerPath;
    const bucketName: string = body?.bucket || "paperflow-files";

    if (!customerId || !offerPath) {
      return json(
        {
          ok: false,
          where: "input",
          message: "customerId och offerPath krävs",
        },
        400
      );
    }

    // 1) Hämta offert-PDF från Storage
    console.log("[create-order] download", { bucketName, offerPath });

    const { data: srcFile, error: dlErr } = await admin.storage
      .from(bucketName)
      .download(offerPath);

    if (dlErr || !srcFile) {
      console.error("[create-order] download error:", dlErr);
      return json(
        {
          ok: false,
          where: "download",
          message: dlErr?.message || "Kunde inte hämta offert-PDF",
        },
        500
      );
    }

    const srcBytes = new Uint8Array(await srcFile.arrayBuffer());
    if (!srcBytes.length) {
      return json(
        {
          ok: false,
          where: "download",
          message: "Tom fil vid nedladdning",
        },
        500
      );
    }

    // 2) Stämpla rubriken till ORDERBEKRÄFTELSE
    const stamped = await stampOrderHeader(srcBytes);

    // 3) Ladda upp som order-PDF
    const ts = Date.now();
    const filename = `order-${ts}.pdf`;
    const destPath = `orders/${customerId}/${filename}`;

    const { error: upErr } = await admin.storage
      .from(bucketName)
      .upload(destPath, stamped, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (upErr) {
      console.error("[create-order] upload error:", upErr);
      return json(
        { ok: false, where: "upload", message: upErr.message },
        500
      );
    }

    // 4) Hämta publik URL till filen
    const { data: pub } = admin.storage
      .from(bucketName)
      .getPublicUrl(destPath);

    const fileUrl = pub?.publicUrl || null;

    // 5) Spara i documents-tabellen
    const { error: docErr } = await admin.from("documents").insert({
      customer_id: customerId,
      doc_type: "order", // passerar din CHECK-constraint
      type: "order",
      storage_path: destPath,
      filename,
      file_url: fileUrl,
      bucket: bucketName,
      bucket_name: bucketName,
      status: "created",
      created_at: new Date().toISOString(),
    });

    if (docErr) {
      console.warn("[create-order] documents insert warn:", docErr.message);
    }

    console.log("[create-order] OK", { destPath, bucketName, fileUrl });

    return json({
      ok: true,
      path: destPath,
      bucket: bucketName,
      fileUrl,
    });
  } catch (err: any) {
    console.error("[create-order] exception:", err);
    return json(
      {
        ok: false,
        where: "exception",
        message: err?.message || String(err),
      },
      500
    );
  }
}
