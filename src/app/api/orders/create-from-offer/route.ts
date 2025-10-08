export const runtime = 'nodejs';
import { supabaseAdmin as admin } from '@/lib/supabaseServer';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

/**
 * Justerbara värden – funkar för båda dina offerter.
 * Finlir:
 *  - Flytta upp/ner: STAMP_Y ± 5–10
 *  - Mer täckning:   höj STAMP_HEIGHT (t.ex. 80)
 *  - Mer logga-lucka: öka LOGO_GAP_HALF (t.ex. 120–140)
 */
const STAMP_ON = true;
const STAMP_Y = 610;
const STAMP_HEIGHT = 72;
const STAMP_LEFT = 76;
const STAMP_RIGHT = 60;
const STAMP_TEXT = 'ORDERBEKRÄFTELSE';
const STAMP_SIZE = 18;

// Lucka runt loggan i mitten (halva gapbredden)
const LOGO_GAP_HALF = 110;

async function stampOrderHeader(src: Uint8Array): Promise<Uint8Array> {
  if (!STAMP_ON) return src;

  const doc = await PDFDocument.load(src);
  const pages = doc.getPages();
  if (!pages.length) return src;

  const page = pages[0];
  const { width } = page.getSize();
  const helvBold = await doc.embedFont(StandardFonts.HelveticaBold);

  // --- Vit banderoll i två delar, lämnar lucka kring loggans mitt ---
  const centerX = width / 2;
  const gapL = centerX - LOGO_GAP_HALF;
  const gapR = centerX + LOGO_GAP_HALF;

  // Vänster del
  page.drawRectangle({
    x: STAMP_LEFT,
    y: STAMP_Y - 6,
    width: Math.max(0, gapL - STAMP_LEFT),
    height: STAMP_HEIGHT,
    color: rgb(1, 1, 1),
  });

  // Höger del
  page.drawRectangle({
    x: gapR,
    y: STAMP_Y - 6,
    width: Math.max(0, width - STAMP_RIGHT - gapR),
    height: STAMP_HEIGHT,
    color: rgb(1, 1, 1),
  });

  // Ny rubrik
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
    const body = await req.json().catch(() => ({} as any));
    const customerId: string | undefined = body?.customerId;
    const offerPath: string | undefined = body?.offerPath;
    const bucketName: string = body?.bucket || 'paperflow-files';

    if (!customerId || !offerPath) {
      return Response.json(
        { ok: false, where: 'input', message: 'customerId och offerPath krävs' },
        { status: 400 }
      );
    }

    const destPath = `orders/${customerId}/${Date.now()}-order.pdf`;

    // 1) Hämta käll-PDF (offerten)
    const { data: srcFile, error: dlErr } = await admin.storage.from(bucketName).download(offerPath);
    if (dlErr || !srcFile) {
      return Response.json(
        { ok: false, where: 'download', message: dlErr?.message || 'Kunde inte hämta offert-PDF' },
        { status: 500 }
      );
    }

    const arr = await srcFile.arrayBuffer();
    let bytes = new Uint8Array(arr);
    if (!bytes || bytes.length < 1000) {
      return Response.json(
        { ok: false, where: 'download', message: `Fil för liten (${bytes?.length || 0} bytes)` },
        { status: 500 }
      );
    }

    // 2) Stämpla endast rubriken
    bytes = await stampOrderHeader(bytes);

    // 3) Ladda upp som order-PDF
    const { error: upErr } = await admin.storage
      .from(bucketName)
      .upload(destPath, bytes, { contentType: 'application/pdf', upsert: true });

    if (upErr) {
      return Response.json({ ok: false, where: 'upload', message: upErr.message }, { status: 500 });
    }

    console.log('[createOrder] uploaded stamped order =', destPath, 'bucket =', bucketName);
    return Response.json({ ok: true, path: destPath, bucket: bucketName }, { status: 200 });
  } catch (e: any) {
    console.error('[createOrder] exception:', e);
    return Response.json({ ok: false, where: 'exception', message: String(e?.message || e) }, { status: 500 });
  }
}
