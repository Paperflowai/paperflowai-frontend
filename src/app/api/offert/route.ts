import { NextResponse } from "next/server";

// Här kan du byta ut mot riktig DB (Supabase, Postgres etc.)
// För demo sparar vi bara i en array i minnet
let offerts: any[] = [];

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { kundId, offertId, kundnamn, pris, beskrivning } = body;

    if (!kundId || !offertId) {
      return NextResponse.json(
        { success: false, error: "kundId och offertId krävs" },
        { status: 400 }
      );
    }

    // Spara offerten (enkelt exempel)
    offerts.push({ kundId, offertId, kundnamn, pris, beskrivning });

    // Skapa en direktlänk
    const url = `https://paperflowai.com/kund/${kundId}/offert/${offertId}`;

    return NextResponse.json({
      success: true,
      message: "Offerten är sparad i PaperflowAI",
      url
    });
  } catch (error) {
    console.error("API-fel:", error);
    return NextResponse.json(
      { success: false, error: "Internt serverfel" },
      { status: 500 }
    );
  }
}
