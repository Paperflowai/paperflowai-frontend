import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { customerId, offer } = await req.json();
    
    if (!customerId || !offer) {
      return NextResponse.json({ 
        error: "Kund-ID och offert krävs" 
      }, { status: 400 });
    }

    // I en riktig app skulle detta sparas i en databas
    // För nu simulerar vi att det sparas
    console.log('Sparar offert för kund:', customerId, offer);

    // Simulera att offerten sparas till localStorage
    // I en riktig app skulle detta hanteras av frontend-koden
    const saveData = {
      customerId,
      offer,
      timestamp: new Date().toISOString()
    };

    return NextResponse.json({ 
      success: true, 
      message: "Offert sparad till kundkort",
      customerId,
      offerId: offer.offerId,
      saveData // Returnera data för frontend att spara
    });

  } catch (error) {
    console.error('Save offer error:', error);
    return NextResponse.json({ 
      error: "Kunde inte spara offert. Försök igen senare." 
    }, { status: 500 });
  }
}
