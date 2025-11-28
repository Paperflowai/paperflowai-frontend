export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import {
  supabaseAdmin as admin,
  supabaseAdminConfigured,
} from "@/lib/supabaseServer";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { upsertFlowStatusServer } from "@/lib/flowStatusServer";
import { linkDocumentRecord } from "@/lib/documentLinks";

function json(data: any, status = 200) {
  return NextResponse.json(data, { status });
}

export async function GET() {
  return json({ ok: true, ping: "invoices/create-from-order" });
}

const INVOICE_STAMP_TEXT = "FAKTURA";
const INVOICE_STAMP_Y = 615;
const INVOICE_STAMP_HEIGHT = 38;
const INVOICE_STAMP_LEFT = 76;
const INVOICE_STAMP_RIGHT = 60;
const INVOICE_STAMP_SIZE = 18;

async function stampInvoiceHeader(src: Uint8Array): Promise<Uint8Array> {
  const doc = await PDFDocument.load(src);
  const pages = doc.getPages();
  if (!pages.length) return src;

  const page = pages[0];
  const { width } = page.getSize();
  const helvBold = await doc.embedFont(StandardFonts.HelveticaBold);

  page.drawRectangle({
    x: INVOICE_STAMP_LEFT,
    y: INVOICE_STAMP_Y - 6,
    width: width - (INVOICE_STAMP_LEFT + INVOICE_STAMP_RIGHT),
    height: INVOICE_STAMP_HEIGHT,
    color: rgb(1, 1, 1),
  });

  page.drawText(INVOICE_STAMP_TEXT, {
    x: INVOICE_STAMP_LEFT,
    y: INVOICE_STAMP_Y,
    size: INVOICE_STAMP_SIZE,
    font: helvBold,
    color: rgb(0, 0, 0),
  });

  return doc.save();
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as any;

    const customerId: string | undefined = body?.customerId;
    const orderPath: string | undefined = body?.orderPath;
    const bucketName: string = body?.bucket || "paperflow-files";
    const orderId: string | undefined = body?.orderId;

    if (!customerId || !orderPath) {
      return json(
        {
          ok: false,
          where: "input",
          message: "customerId och orderPath krävs",
        },
        400
      );
    }

    if (!supabaseAdminConfigured) {
      return json(
        {
          ok: false,
          where: "config",
          message: "Supabase service role saknas. Ställ in miljövariablerna.",
        },
        503
      );
    }

    const { data: srcFile, error: dlErr } = await admin.storage
      .from(bucketName)
      .download(orderPath);

    if (dlErr || !srcFile) {
      console.error("[create-invoice] download error:", dlErr);
      return json(
        {
          ok: false,
          where: "download",
          message: dlErr?.message || "Kunde inte hämta order-PDF",
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

    const stamped = await stampInvoiceHeader(srcBytes);

    const ts = Date.now();
    const filename = `invoice-${ts}.pdf`;
    const destPath = `invoices/${customerId}/${filename}`;

    const { error: upErr } = await admin.storage
      .from(bucketName)
      .upload(destPath, stamped, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (upErr) {
      console.error("[create-invoice] upload error:", upErr);
      return json(
        { ok: false, where: "upload", message: upErr.message },
        500
      );
    }

    const { data: pub } = admin.storage
      .from(bucketName)
      .getPublicUrl(destPath);

    const fileUrl = pub?.publicUrl || null;

    const { error: docErr } = await admin.from("documents").insert({
      customer_id: customerId,
      doc_type: "invoice",
      type: "invoice",
      storage_path: destPath,
      filename,
      file_url: fileUrl,
      bucket: bucketName,
      bucket_name: bucketName,
      status: "created",
      created_at: new Date().toISOString(),
    });

    if (docErr) {
      console.warn("[create-invoice] documents insert warn:", docErr.message);
    }

    const linked = await linkDocumentRecord({
      table: "invoices",
      customerId,
      storagePath: destPath,
      bucket: bucketName,
      fileUrl,
      status: "created",
      sourceOrderId: orderId ?? null,
      sourceOrderPath: orderPath,
    });

    if (!linked.ok) {
      console.warn(
        "[create-invoice] link invoice warn:",
        linked.error?.message || linked.error
      );
    }

    await upsertFlowStatusServer(customerId, { invoiceCreated: true });

    console.log("[create-invoice] OK", { destPath, bucketName, fileUrl });

    return json({
      ok: true,
      path: destPath,
      bucket: bucketName,
      fileUrl,
    });
  } catch (err: any) {
    console.error("[create-invoice] exception:", err);
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
