import { NextResponse } from "next/server";

function bad(msg: string, code = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status: code });
}

interface OrderData {
  customerId: string;
  offerData: {
    offerId: string;
    amount: number;
    currency: string;
  };
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as OrderData;
    const { customerId, offerData } = body;

    if (!customerId) {
      return bad("Missing customer ID");
    }
    if (!offerData?.offerId) {
      return bad("Missing offerId in offerData");
    }

    // ✅ Skapa order baserad på offert
    const order = {
      id: Date.now().toString(),
      customerId,
      title: "Order",
      amount: offerData.amount,
      currency: offerData.currency || "SEK",
      offerId: offerData.offerId, // 🔧 fix här
    };

    // Här kan du lägga logik för att spara ordern i Supabase
    // eller skapa PDF för orderbekräftelse

    return NextResponse.json(
      {
        ok: true,
        message: "Order skapad",
        order,
      },
      { status: 200 }
    );
  } catch (e: any) {
    return bad(e?.message ?? "Unknown error", 500);
  }
}
