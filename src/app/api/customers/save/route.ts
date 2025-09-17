import { NextResponse } from "next/server";

type SaveCustomerBody = {
  customer: {
    id: string;
    companyName: string;
    orgNr?: string;
    contactPerson?: string;
    role?: string;
    phone?: string;
    email?: string;
    address?: string;
    zip?: string;
    city?: string;
    country?: string;
    contactDate?: string;
    notes?: string;
    customerNumber: string;
    offers?: any[];
  };
};

function bad(msg: string, code = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status: code });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as SaveCustomerBody;
    
    if (!body?.customer?.id) {
      return bad("Missing customer ID");
    }

    if (!body?.customer?.customerNumber) {
      return bad("Missing customer number");
    }

    // Hämta befintliga kunder från localStorage
    const existingCustomers = JSON.parse(
      localStorage.getItem('paperflow_customers_v1') || '[]'
    );

    // Kontrollera om kund redan finns
    const existingIndex = existingCustomers.findIndex(
      (c: any) => String(c.id) === String(body.customer.id)
    );

    if (existingIndex !== -1) {
      // Uppdatera befintlig kund
      existingCustomers[existingIndex] = {
        ...existingCustomers[existingIndex],
        ...body.customer
      };
    } else {
      // Lägg till ny kund
      existingCustomers.push(body.customer);
    }

    // Spara tillbaka till localStorage
    localStorage.setItem('paperflow_customers_v1', JSON.stringify(existingCustomers));

    // Spara också i den gamla strukturen för kompatibilitet
    localStorage.setItem(`kund_${body.customer.id}`, JSON.stringify({
      companyName: body.customer.companyName,
      orgNr: body.customer.orgNr,
      contactPerson: body.customer.contactPerson,
      role: body.customer.role,
      phone: body.customer.phone,
      email: body.customer.email,
      address: body.customer.address,
      zip: body.customer.zip,
      city: body.customer.city,
      country: body.customer.country,
      contactDate: body.customer.contactDate,
      notes: body.customer.notes,
      customerNumber: body.customer.customerNumber
    }));

    return NextResponse.json({
      ok: true,
      customer: body.customer,
      message: existingIndex !== -1 ? "Kund uppdaterad" : "Ny kund sparad"
    }, { status: 200 });

  } catch (e: any) {
    return bad(e?.message ?? "Unknown error", 500);
  }
}
