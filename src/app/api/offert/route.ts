import { NextResponse } from "next/server";

// Här kan du byta ut mot riktig DB (Supabase, Postgres etc.)
// För demo sparar vi bara i en array i minnet
let offerts: any[] = [];

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { kundId, offertId, kundnamn, pris, beskrivning, customerData } = body;

    // Om ingen kundId finns, skapa en ny kund automatiskt
    let finalKundId = kundId;
    if (!finalKundId) {
      finalKundId = Date.now().toString();
      
      // Skapa ny kund med automatiskt genererat kundnummer
      const customerNumber = `K-${Math.floor(Math.random() * 9000000) + 1000000}`;
      const today = new Date().toISOString().split('T')[0];
      
      const newCustomer = {
        id: finalKundId,
        companyName: kundnamn || "",
        orgNr: customerData?.orgNr || "",
        contactPerson: customerData?.contactPerson || "",
        role: customerData?.role || "",
        phone: customerData?.phone || "",
        email: customerData?.email || "",
        address: customerData?.address || "",
        zip: customerData?.zip || "",
        city: customerData?.city || "",
        country: customerData?.country || "Sverige",
        contactDate: today,
        notes: customerData?.notes || "",
        customerNumber: customerNumber,
        offers: []
      };

      // Spara till localStorage (via API response som frontend kan hantera)
      console.log("Skapar ny kund:", newCustomer);
    }

    if (!offertId) {
      return NextResponse.json(
        { success: false, error: "offertId krävs" },
        { status: 400 }
      );
    }

    // Spara offerten (enkelt exempel)
    offerts.push({ kundId: finalKundId, offertId, kundnamn, pris, beskrivning });

    // Skapa en direktlänk
    const url = `https://paperflowai.com/kund/${finalKundId}/offert/${offertId}`;

    return NextResponse.json({
      success: true,
      message: "Offerten är sparad i PaperflowAI",
      url,
      customerId: finalKundId,
      customerCreated: !kundId // Indikera om kund skapades automatiskt
    });
  } catch (error) {
    console.error("API-fel:", error);
    return NextResponse.json(
      { success: false, error: "Internt serverfel" },
      { status: 500 }
    );
  }
}
