import { NextResponse } from "next/server";

function bad(msg: string, code = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status: code });
}

interface InvoiceData {
  customerId: string;
  orderData: {
    orderId: string;
    amount: number;
    currency: string;
  };
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as InvoiceData;
    const { customerId, orderData } = body;

    if (!customerId) {
      return bad("Missing customer ID");
    }
    if (!orderData?.orderId) {
      return bad("Missing orderId in orderData");
    }

    // ✅ Skapa faktura baserad på orderData
    const invoice = {
      id: Date.now().toString(),
      customerId,
      title: "Faktura",
      amount: orderData.amount,
      currency: orderData.currency || "SEK",
      orderId: orderData.orderId, // 🔧 fix: använd orderData.orderId
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0],
    };

    // Just nu simulerar vi att vi sparar fakturan
    // Här kan du ersätta med Supabase .insert()

    return NextResponse.json(
      {
        ok: true,
        message: "Faktura skapad",
        invoice,
      },
      { status: 200 }
    );
  } catch (e: any) {
    return bad(e?.message ?? "Unknown error", 500);
  }
}
