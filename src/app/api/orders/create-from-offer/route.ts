export const runtime = 'nodejs';
import { supabaseAdmin as admin } from '@/lib/supabaseServer';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

/**
 * Justerbara värden för rubrikens position/utseende.
 * Behöver rubriken flyttas: ändra bara STAMP_Y (större = högre upp, mindre = längre ned).
 */
const STAMP_ON = true;       // slå av/på stämpeln vid felsökning
const STAMP_Y = 672;         // var 655 – aningen upp för att linjera bättre
const STAMP_HEIGHT = 38;     // var 34 – högre banderoll så gamla "OFFERT" aldrig skymtar
const STAMP_LEFT = 60;       // samma som offerten
const STAMP_RIGHT = 60;      // samma som offerten
const STAMP_TEXT = 'ORDERBEKRÄFTELSE';
const STAMP_SIZE = 14;       // var 12 – något större så rubriken matchar offerten bättre

async function stampOrderHeader(src: Uint8Array): Promise<Uint8Array> {
  if (!STAMP_ON) return src;

  const doc = await PDFDocument.load(src);
  const pages = doc.getPages();
  if (!pages.length) return src;

  const page = pages[0];
  const { width } = page.getSize();
  const helv = await doc.embedFont(StandardFonts.Helvetica);
  const helvBold = await doc.embedFont(StandardFonts.HelveticaBold);

  // 1) Vit banderoll som täcker den gamla rubriken
  page.drawRectangle({
    x: STAMP_LEFT,
    y: STAMP_Y - 6,
    width: width - (STAMP_LEFT + STAMP_RIGHT),
    height: STAMP_HEIGHT,
    color: rgb(1, 1, 1),
  });

  // 2) Ny rubrik
  page.drawText(STAMP_TEXT, {
    x: STAMP_LEFT,
    y: STAMP_Y,
    size: STAMP_SIZE,
    font: helvBold,
    color: rgb(0, 0, 0),
  });

  // 3) Datumrad i ljusgrått under (frivilligt)
  page.drawText(new Date().toLocaleDateString('sv-SE'), {
    x: STAMP_LEFT,
    y: STAMP_Y - 16,
    size: 9,
    font: helv,
    color: rgb(0.4, 0.4, 0.4),
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

    // 1) Ladda ner offert-PDF (samma layout som originalet)
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

    // 2) Stämpla rubriken (endast rubriken byts – layouten i övrigt är identisk)
    bytes = await stampOrderHeader(bytes);

    // 3) Ladda upp som order-PDF
    const { error: upErr } = await admin.storage
      .from(bucketName)
      .upload(destPath, bytes, { contentType: 'application/pdf', upsert: true });

    if (upErr) {
      return Response.json({ ok: false, where: 'upload', message: upErr.message }, { status: 500 });
    }

    console.log('[createOrder] uploaded stamped order =', destPath, 'bucket =', bucketName);
    // UI hämtar sedan som blob och visar (ingen signed URL).
    return Response.json({ ok: true, path: destPath, bucket: bucketName }, { status: 200 });
  } catch (e: any) {
    console.error('[createOrder] exception:', e);
    return Response.json({ ok: false, where: 'exception', message: String(e?.message || e) }, { status: 500 });
  }
}
