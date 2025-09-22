import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";

function bad(msg: string, code = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status: code });
}

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
  [key: string]: any; // tillåt extra fält om de finns i databasen
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { offer } = body;

    if (!offer) return bad("Missing offer data");

    const { email, name } = offer;
    if (!email) return bad("Missing customer email in offer");

    // Hämta kunder som matchar e-post
    const { data: customers, error: customersError } = await supabaseAdmin
      .from("customers")
      .select("*")
      .eq("email", email);

    if (customersError) {
      return bad(`Failed to fetch customers: ${customersError.message}`, 500);
    }

    let customerId: string | null = null;
    let customerCreated = false;

    // Om kunden redan finns
    const existingCustomer: Customer | undefined = customers?.find(
      (c: Customer) => c.email === email
    );

    if (existingCustomer) {
      // Använd befintlig kund
      customerId = existingCustomer.id;
      customerCreated = false;

      // Uppdatera befintlig kund med ny offertdata (om något har ändrats)
      const { error: updateError } = await supabaseAdmin
        .from("customers")
        .update({
          name: offer.name ?? existingCustomer.name,
          phone: offer.phone ?? existingCustomer.phone,
          orgnr: offer.orgnr ?? existingCustomer.orgnr,
          address: offer.address ?? existingCustomer.address,
          zip: offer.zip ?? existingCustomer.zip,
          city: offer.city ?? existingCustomer.city,
          country: offer.country ?? existingCustomer.country,
        })
        .eq("id", existingCustomer.id);

      if (updateError) {
        console.warn("Failed to update customer:", updateError.message);
      }
    } else {
      // Skapa ny kund
      const { data: newCustomer, error: insertError } = await supabaseAdmin
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

      if (insertError) {
        return bad(`Failed to create customer: ${insertError.message}`, 500);
      }

      customerId = newCustomer.id;
      customerCreated = true;
    }

    return NextResponse.json(
      {
        ok: true,
        customerId,
        customerCreated,
      },
      { status: 200 }
    );
  } catch (e: any) {
    return bad(e?.message ?? "Unknown error", 500);
  }
}
