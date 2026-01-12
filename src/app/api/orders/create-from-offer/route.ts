export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { supabaseAdmin as admin } from "@/lib/supabaseServer";
import { buildDocument } from "@/lib/pdf/buildDocument";
import crypto from "crypto";

function json(data: any, status = 200) {
  return NextResponse.json(data, { status });
}

// ✅ Enkel ping för att testa i browsern
export async function GET() {
  return json({ ok: true, ping: "orders/create-from-offer" });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as any;

    const customerId: string | undefined = body?.customerId;
    const originalOfferPath: string | undefined = body?.offerPath;
    let bucketName: string = body?.bucket || "documents";

    // Vi kommer eventuellt att plocka path + bucket från senaste offerten
    let effectiveOfferPath: string | undefined = originalOfferPath;

    if (!customerId) {
      return json(
        {
          ok: false,
          where: "input",
          message: "customerId krävs",
        },
        400
      );
    }

    // Hämta senaste offerten för kunden (inklusive data för att skapa order-PDF)
    const { data: latestOffer } = await admin
      .from("offers")
      .select("id, data, customer_id, amount, payload")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestOffer && latestOffer.data) {
      // Hämta kunddata från customers-tabellen
      const { data: customer, error: customerError } = await admin
        .from("customers")
        .select("*")
        .eq("id", customerId)
        .single();

      if (customerError || !customer) {
        console.error("[create-order] customer fetch error:", customerError);
        return json(
          { ok: false, where: "database", message: "Kund hittades inte" },
          404
        );
      }
      // Generera ordernummer
      const currentYear = new Date().getFullYear();
      const { data: lastOrder } = await admin
        .from("orders")
        .select("number")
        .like("number", `ORD-${currentYear}-%`)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      let orderNumber = `ORD-${currentYear}-0001`;
      if (lastOrder?.number) {
        const match = lastOrder.number.match(/ORD-(\d+)-(\d+)/);
        if (match) {
          const year = parseInt(match[1]);
          const num = parseInt(match[2]);
          if (year === currentYear) {
            const newNum = String(num + 1).padStart(4, '0');
            orderNumber = `ORD-${currentYear}-${newNum}`;
          }
        }
      }

      // Beräkna totals från offer data
      const totalSum = parseFloat(latestOffer.data?.details?.totalSum || latestOffer.amount || '0');
      const vatPercent = parseFloat(latestOffer.data?.details?.vatPercent || '25');
      const vatTotal = totalSum * (vatPercent / 100);

      // Kopiera items från offert och sätt som godkända
      const offerItems = latestOffer.data?.details?.items || latestOffer.data?.items || [];
      const rows = offerItems.map((item: any) => ({
        id: item.id || crypto.randomUUID(),
        description: item.description || item.name || "",
        qty: parseFloat(item.qty || item.quantity || 0),
        price: parseFloat(item.price || item.unitPrice || 0),
        source: "offer",
        approved: true,
        approved_at: new Date().toISOString(),
      }));

      // Förbered dokumentdata för order med faktisk kunddata från customers-tabellen
      const documentData = {
        customer: {
          companyName: customer.company_name,
          orgNr: customer.org_nr || customer.orgnr,
          contactPerson: customer.contact_person,
          role: customer.role,
          email: customer.email,
          phone: customer.phone,
          address: customer.address,
          zip: customer.zip,
          city: customer.city,
          country: customer.country || "Sverige",
          customerNumber: customer.customer_number,
          contactDate: customer.contact_date,
        },
        details: latestOffer.data?.details || latestOffer.data || {},
        rows,
        number: orderNumber,
      };

      // Generera order-PDF med buildDocument
      const pdfBytes = await buildDocument({ type: "order", data: documentData });

      // Ladda upp som order-PDF
      const fileName = `${currentYear}/${customerId}/${orderNumber}.pdf`;
      const storagePath = `orders/${fileName}`;

      const { error: upErr } = await admin.storage
        .from(bucketName)
        .upload(storagePath, pdfBytes, {
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

      // Hämta publik URL till filen
      const { data: pub } = admin.storage
        .from(bucketName)
        .getPublicUrl(storagePath);

      const fileUrl = pub?.publicUrl || null;

      // Spara i orders-tabellen
      const { data: order, error: orderError } = await admin
        .from("orders")
        .insert({
          customer_id: customerId,
          source_offer_id: latestOffer.id,
          number: orderNumber,
          status: 'created',
          data: documentData,
          pdf_url: fileUrl,
          storage_path: storagePath,
          bucket_name: bucketName,
          total: totalSum,
          vat_total: vatTotal,
        })
        .select()
        .single();

      if (orderError) {
        console.error("[create-order] orders insert error:", orderError);
        return json(
          { ok: false, where: "database", message: "Kunde inte spara order i databasen" },
          500
        );
      }

      console.log("[create-order] OK", { orderId: order.id, orderNumber });

      return json({
        ok: true,
        order,
      });
    } else {
      // Om ingen offert finns: returnera fel
      return json(
        {
          ok: false,
          where: "input",
          message: "Ingen offert hittades för kunden",
        },
        404
      );
    }
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
