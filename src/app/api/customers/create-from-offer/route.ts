import { NextResponse } from "next/server";

type CreateCustomerFromOfferBody = {
  offerData: {
    offerId: string;
    customerName?: string;
    amount?: number;
    currency?: string;
    items?: any[];
    date?: string;
    validUntil?: string;
  };
  customerData?: {
    companyName?: string;
    orgNr?: string;
    contactPerson?: string;
    role?: string;
    phone?: string;
    email?: string;
    address?: string;
    zip?: string;
    city?: string;
    country?: string;
    notes?: string;
  };
};

function bad(msg: string, code = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status: code });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as CreateCustomerFromOfferBody;
    
    if (!body?.offerData?.offerId) {
      return bad("Missing offerId");
    }

    const customerName = body.customerData?.companyName || body.offerData.customerName || "";
    const customerEmail = body.customerData?.email || "";
    const customerOrgNr = body.customerData?.orgNr || "";

    // Kontrollera om kund redan finns i registret
    let existingCustomer = null;
    let customerId = "";
    let customerCreated = false;

    // Simulera sökning i kundregister (i riktig app skulle detta vara databas)
    // Sök efter matchande företagsnamn, e-post eller org.nr
    if (customerName || customerEmail || customerOrgNr) {
      // Här skulle vi söka i databasen efter befintlig kund
      // För nu returnerar vi null för att simulera att ingen kund hittades
      existingCustomer = null;
    }

    if (existingCustomer) {
      // Använd befintlig kund
      customerId = existingCustomer.id;
      customerCreated = false;
      
      // Uppdatera befintlig kund med ny offertdata (om något har ändrats)
      const updatedCustomer = {
        ...existingCustomer,
        offers: [...(existingCustomer.offers || []), body.offerData]
      };
      
      const offerData = {
        customerId: customerId,
        title: body.offerData.customerName || "Offert",
        amount: body.offerData.amount || 0,
        currency: body.offerData.currency || "SEK",
        dataJson: JSON.stringify({
          offerId: body.offerData.offerId,
          items: body.offerData.items || [],
          date: body.offerData.date,
          validUntil: body.offerData.validUntil,
          customerData: body.customerData
        })
      };

      return NextResponse.json({
        ok: true,
        customer: updatedCustomer,
        offerData: offerData,
        message: "Offert tillagd till befintlig kund",
        customerFound: true
      }, { status: 200 });

    } else {
      // Skapa ny kund
      customerId = Date.now().toString();
      const customerNumber = `K-${Math.floor(Math.random() * 9000000) + 1000000}`;
      const today = new Date().toISOString().split('T')[0];
      customerCreated = true;

      const newCustomer = {
        id: customerId,
        companyName: customerName,
        orgNr: customerOrgNr,
        contactPerson: body.customerData?.contactPerson || "",
        role: body.customerData?.role || "",
        phone: body.customerData?.phone || "",
        email: customerEmail,
        address: body.customerData?.address || "",
        zip: body.customerData?.zip || "",
        city: body.customerData?.city || "",
        country: body.customerData?.country || "Sverige",
        contactDate: today,
        notes: body.customerData?.notes || "",
        customerNumber: customerNumber,
        offers: [body.offerData]
      };

      const offerData = {
        customerId: customerId,
        title: body.offerData.customerName || "Offert",
        amount: body.offerData.amount || 0,
        currency: body.offerData.currency || "SEK",
        dataJson: JSON.stringify({
          offerId: body.offerData.offerId,
          items: body.offerData.items || [],
          date: body.offerData.date,
          validUntil: body.offerData.validUntil,
          customerData: body.customerData
        })
      };

      // Spara kunddata till localStorage
      try {
        const saveResponse = await fetch('/api/customers/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ customer: newCustomer })
        });
        
        if (!saveResponse.ok) {
          console.warn('Failed to save customer to localStorage');
        }
      } catch (error) {
        console.warn('Error saving customer:', error);
      }

      return NextResponse.json({
        ok: true,
        customer: newCustomer,
        offerData: offerData,
        message: "Ny kund och offert skapade automatiskt",
        customerFound: false
      }, { status: 200 });
    }

  } catch (e: any) {
    return bad(e?.message ?? "Unknown error", 500);
  }
}
