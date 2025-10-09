import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const BUCKET = "offers";

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false },
});

const clean = (s: string) => s.replace(/[^\w.\-]+/g, "_");

/** Valfri PDF-läsning: körs bara om EXTRACT_FROM_PDF=true och pdf-parse är installerat. */
async function extractText(buf: Buffer): Promise<string | null> {
  if (process.env.EXTRACT_FROM_PDF !== "true") return null;
  try {
    const mod = (await import("pdf-parse").catch(() => null)) as any;
    if (!mod?.default) return null;
    const res = await mod.default(buf);
    return res?.text || null;
  } catch {
    return null;
  }
}

/** Heuristik: plocka kundfält ur text */
function pickCustomerFields(text: string) {
  const out: any = {};
  const email = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0];
  if (email) out.email = email;
  const org = text.match(/\b\d{6}-\d{4}\b|\b\d{10}\b/)?.[0];
  if (org) out.org_nr = org;
  const phone = text.match(/(\+46|0)\s?\d[\d\s\-]{6,}/)?.[0];
  if (phone) out.phone = phone.replace(/\s+/g, " ").trim();
  const mZipCity = text.match(/\b(\d{3}\s?\d{2})\s+([A-Za-zÅÄÖåäö\- ]{2,})\b/);
  if (mZipCity) {
    out.postnummer = mZipCity[1].replace(/\s/, "");
    out.ort = mZipCity[2].trim();
  }
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (mZipCity) {
    const idx = lines.findIndex(
      (l) =>
        l.includes(mZipCity[1].replace(/\s/, "")) || l.includes(mZipCity[1]),
    );
    if (idx > 0) out.adress = lines[idx - 1];
  }
  const nameLabel =
    text.match(/Företagsnamn[:\s]+(.{2,})/i) ||
    text.match(/Kund[:\s]+(.{2,})/i);
  if (nameLabel) out.name = nameLabel[1].split(/\r?\n/)[0].trim();
  if (!out.name && lines.length) out.name = lines[0].slice(0, 80);
  const cust = text.match(/\bK-\d+\b/i)?.[0];
  if (cust) out.customer_number = cust.toUpperCase();
  return out;
}

/** Uppdatera customers – “best effort”, sväljer fel om kolumn saknas */
async function updateCustomerBestEffort(
  customerId: string,
  fields: Record<string, any>
) {
  if (!fields || !Object.keys(fields).length) return null;

  // Läs befintlig kundrad för att se vilka kolumner som finns
  const cur = await admin
    .from("customers")
    .select("*")
    .or(`id.eq.${customerId},slug.eq.${customerId}`)
    .single();

  const cols: string[] = cur.data ? Object.keys(cur.data) : [];

  // Synonymer -> välj det kolumnnamn som faktiskt finns i din tabell
  const synonyms: Record<string, string[]> = {
    name: ["name","namn","företagsnamn","company_name"],
    email: ["email","e_post","e-post","epost"],
    phone: ["phone","telefon","tel"],
    adress: ["address","adress","gata","street"],
    postnummer: ["postal_code","postnummer","postnr","zip"],
    ort: ["city","ort","stad"],
    org_nr: ["org_nr","orgnr","organisationsnummer","organisation_nr"],
    customer_number: ["customer_number","kundnummer","kundnr","offertnummer_ref"],
  };

  const payload: Record<string, any> = {};
  for (const [k, variants] of Object.entries(synonyms)) {
    const v = fields[k];
    if (v == null) continue;
    const target = variants.find((name) => cols.includes(name));
    if (target) payload[target] = v;
  }
  if (!Object.keys(payload).length) return null;

  await admin
    .from("customers")
    .update(payload)
    .or(`id.eq.${customerId},slug.eq.${customerId}`);

  return payload; // <- exakta DB-kolumner som uppdaterades
}

/** Robust insert som provar olika fältnamn tills det går igenom. */
async function smartInsertDocument(base: {
  customer_id: string;
  url: string;
  storage_path: string;
  filename: string;
  bucket: string;
}) {
  const urlVariants = [{ url: base.url }, { file_url: base.url }, { pdf_url: base.url }];
  const typeVariants = [
    { doc_type: "offer", type: "offer" },
    { doc_type: "offer" },
    { type: "offer" },
    {},
  ];
  const statusVariants = [{ status: "imported" }, {}];
  const nameVariants = [
    { filename: base.filename },
    { file_name: base.filename },
    { name: base.filename },
    { title: base.filename },
  ];
  const storageVariants = [
    { storage_path: base.storage_path, bucket: base.bucket },
    { storage_path: base.storage_path, bucket_name: base.bucket },
    { storage_path: base.storage_path },
    {},
  ];

  let lastErr: any = null;
  for (const u of urlVariants) {
    for (const t of typeVariants) {
      for (const s of statusVariants) {
        for (const n of nameVariants) {
          for (const st of storageVariants) {
            const payload = {
              customer_id: base.customer_id,
              ...u,
              ...t,
              ...s,
              ...n,
              ...st,
            };
            const { data, error } = await admin
              .from("documents")
              .insert(payload)
              .select()
              .single();
            if (!error) return { data };
            lastErr = error;
          }
        }
      }
    }
  }
  return { error: lastErr };
}

export async function POST(
  req: Request,
  ctx: { params: { id: string } },
) {
  const customerId = decodeURIComponent(ctx.params.id || "");
  if (!customerId)
    return NextResponse.json({ error: "missing customer id" }, { status: 400 });

  // --- form & file
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "invalid form-data" }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File))
    return NextResponse.json({ error: "file required" }, { status: 400 });
  if (!/pdf/i.test(file.type))
    return NextResponse.json({ error: "PDF only" }, { status: 415 });

  // --- storage
  try {
    await admin.storage.createBucket(BUCKET, { public: true });
  } catch {}
  try {
    await admin.storage.updateBucket(BUCKET, { public: true });
  } catch {}

  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = clean(file.name);
  const key = `${customerId}/${ts}-${filename}`; // storage_path
  const buf = Buffer.from(await file.arrayBuffer());

  const up = await admin
    .storage
    .from(BUCKET)
    .upload(key, buf, { contentType: file.type, upsert: true });
  if (up.error)
    return NextResponse.json(
      { error: up.error.message, where: "storage.upload" },
      { status: 500 },
    );

  // public URL eller signed
  let url = admin.storage.from(BUCKET).getPublicUrl(key).data.publicUrl;
  if (!url) {
    const s = await admin.storage.from(BUCKET).createSignedUrl(key, 60 * 60 * 24);
    if (s.error)
      return NextResponse.json(
        { error: s.error.message, where: "storage.signedUrl" },
        { status: 500 },
      );
    url = s.data?.signedUrl || "";
  }

  // --- robust insert till documents
  const ins = await smartInsertDocument({
    customer_id: customerId,
    url,
    storage_path: key,
    filename,
    bucket: BUCKET,
  });
  if (ins.error)
    return NextResponse.json(
      { error: ins.error.message, where: "insert.documents" },
      { status: 500 },
    );

  // --- (valfritt) extrahera kundfält och uppdatera customers – stoppar aldrig upload
  let patched: any = null;
  let applied: any = null;
  try {
    const text = await extractText(buf);
    if (text) {
      patched = pickCustomerFields(text);
      applied = await updateCustomerBestEffort(customerId, patched);
    }
  } catch {}

  const debug = {
    extractEnabled: process.env.EXTRACT_FROM_PDF === "true",
    parsedChars: (await extractText(buf))?.length || 0,
  };

  return NextResponse.json({ ok: true, offer: ins.data, patched, applied, debug }, { status: 201 });
}
