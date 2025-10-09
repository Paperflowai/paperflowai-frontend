import { NextResponse } from "next/server";
import { supabaseAdmin as admin } from "@/lib/supabaseServer";
// Robust import: funkar oavsett om buildDocument exporteras som default eller named
import * as pdf from "@/lib/pdf/buildDocument";
const buildDocument = (pdf as any).buildDocument ?? (pdf as any).default;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function err(where: string, message: string, status = 500) {
  console.error(`[${where}]`, message);
  return NextResponse.json({ ok: false, where, message }, { status });
}

// Byt om du använder annan bucket. Av dina loggar verkar den heta 'offers'.
const BUCKET = "offers";

interface Customer {
  id: string;
  name?: string;
  email?: string;
  phone?: string;
  orgnr?: string;
  address?: string;
  zip?: string;
  city?: string;
  country?: string;
  [k: string]: any;
}

// Viktigt för Next 15: använd "context: any" – INTE typad { params: { id: string } }
export async function POST(req: Request, context: any) {
  try {
    const body = await req.json();
    const offer = body?.offer;

    if (!offer) return err("validate", "Missing offer data", 400);
    if (!offer.email) return err("validate", "Missing customer email in offer", 400);

    // 1) Hämta/korrigera kund via e-post
    const { data: customers, error: fetchErr } = await admin
      .from("customers")
      .select("*")
      .eq("email", offer.email);

    if (fetchErr) return err("fetchCustomers", fetchErr.message);

    let customerId: string | null = null;
    const existing: Customer | undefined = customers?.find((c) => c.email === offer.email);

    if (existing) {
      customerId = existing.id;
      await admin
        .from("customers")
        .update({
          name: offer.name ?? existing.name,
          phone: offer.phone ?? existing.phone,
          orgnr: offer.orgnr ?? existing.orgnr,
          address: offer.address ?? existing.address,
          zip: offer.zip ?? existing.zip,
          city: offer.city ?? existing.city,
          country: offer.country ?? existing.country,
        })
        .eq("id", existing.id);
    } else {
      const { data: created, error: insertErr } = await admin
        .from("customers")
        .insert([
          {
            name: offer.name,
            email: offer.email,
            phone: offer.phone,
            orgnr: offer.orgnr,
            address: offer.address,
            zip: offer.zip,
            city: offer.city,
            country: offer.country,
          },
        ])
        .select()
        .single();

      if (insertErr) return err("createCustomer", insertErr.message);
      customerId = created!.id;
    }

    if (!customerId) return err("invariant", "customerId saknas efter upsert");

    // 2) Bygg ORDERBEKRÄFTELSE som PDF
    const bytes = await buildDocument(
      {
        customerId,
        title: "Orderbekräftelse",
        amount: Number(offer.amount ?? 0),
        currency: String(offer.currency ?? "SEK"),
        needsPrint: Boolean(offer.needsPrint ?? false),
        data: {
          customerName: offer.companyName ?? offer.name ?? "",
          customerAddress: offer.address ?? "",
          customerPhone: offer.phone ?? "",
          customerEmail: offer.email ?? "",
          orderNumber: `ORD-${Date.now()}`,
          orderDate: new Date().toLocaleDateString("sv-SE"),
          source: "order-from-offer",
          ...offer,
        },
      },
      "orderConfirmation"
    );

    console.log("[create-order] pdf bytes length =", bytes?.length);
    if (!bytes || bytes.length < 1000) return err("buildPdf", "PDF blev för liten");

    // 3) Ladda upp PDF till Storage
    const fileName = `${Date.now()}-order.pdf`;
    const filePath = `orders/${customerId}/${fileName}`;
    const blob = new Blob([bytes], { type: "application/pdf" });

    const { error: upErr } = await admin.storage
      .from(BUCKET)
      .upload(filePath, blob, { contentType: "application/pdf", upsert: true });

    if (upErr) return err("upload", upErr.message, (upErr as any)?.statusCode ?? 500);

    // 4) Returnera path & bucket
    return NextResponse.json({ ok: true, path: filePath, bucket: BUCKET, customerId }, { status: 200 });
  } catch (e: any) {
    return err("createOrder", String(e?.message || e));
  }
}
