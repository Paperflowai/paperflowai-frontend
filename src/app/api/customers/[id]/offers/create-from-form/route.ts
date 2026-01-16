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

  // NYA FÄLT
  property_designation?: string;
  association_orgnr?: string;
  personal_number?: string;

  [k: string]: any;
}

// Viktigt för Next 15: använd "context: any" – INTE typad { params: { id: string } }
export async function POST(req: Request, context: any) {
  try {
    const body = await req.json();
    const offer = body?.offer || body;

    if (!offer) return err("validate", "Missing offer data", 400);
    if (!offer.email) return err("validate", "Missing customer email in offer", 400);

    // Mappa fältnamn från formuläret till databas-namn
    const mappedOffer = {
      name: offer.companyName || offer.name,
      email: offer.email,
      phone: offer.phone,
      orgnr: offer.orgNr || offer.orgnr,
      address: offer.address,
      zip: offer.zip,
      city: offer.city,
      country: offer.country,
      property_designation: offer.property_designation,
      association_orgnr: offer.association_orgnr,
      personal_number: offer.personal_number,
    };

    // 1) Hämta/korrigera kund via e-post
    const { data: customers, error: fetchErr } = await admin
      .from("customers")
      .select("*")
      .eq("email", mappedOffer.email);

    if (fetchErr) return err("fetchCustomers", fetchErr.message);

    let customerId: string | null = null;
    const existing: Customer | undefined = customers?.find((c) => c.email === mappedOffer.email);

    if (existing) {
      customerId = existing.id;
      await admin
        .from("customers")
        .update({
          name: mappedOffer.name ?? existing.name,
          phone: mappedOffer.phone ?? existing.phone,
          orgnr: mappedOffer.orgnr ?? existing.orgnr,
          address: mappedOffer.address ?? existing.address,
          zip: mappedOffer.zip ?? existing.zip,
          city: mappedOffer.city ?? existing.city,
          country: mappedOffer.country ?? existing.country,

          // NYA FÄLT (sparas om de finns)
          property_designation: mappedOffer.property_designation ?? existing.property_designation,
          association_orgnr: mappedOffer.association_orgnr ?? existing.association_orgnr,
          personal_number: mappedOffer.personal_number ?? existing.personal_number,
        })
        .eq("id", existing.id);
    } else {
      const { data: created, error: insertErr } = await admin
        .from("customers")
        .insert([
          {
            name: mappedOffer.name,
            email: mappedOffer.email,
            phone: mappedOffer.phone,
            orgnr: mappedOffer.orgnr,
            address: mappedOffer.address,
            zip: mappedOffer.zip,
            city: mappedOffer.city,
            country: mappedOffer.country,

            // NYA FÄLT
            property_designation: mappedOffer.property_designation,
            association_orgnr: mappedOffer.association_orgnr,
            personal_number: mappedOffer.personal_number,
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
