import { NextResponse } from "next/server";

function bad(msg: string, code = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status: code });
}

interface InvoiceData {
  invoiceId: string;
  customerId: string;
  amount: number;
  currency: string;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { invoiceData: InvoiceData };

    if (!body?.invoiceData?.invoiceId) {
      return bad("Missing invoiceId in invoiceData");
    }

    const { invoiceData } = body;
    const { invoiceId, customerId, amount, currency } = invoiceData;

    // 🔎 Här skickar du fakturan till bokföringen (simuleras nu)
    // T.ex. integration till Fortnox/Visma senare

    // ✅ Logga för utveckling
    console.log("Faktura skickad till bokföring:", {
      invoiceId,
      customerId,
      amount,
      currency,
    });

    return NextResponse.json(
      {
        ok: true,
        message: "Faktura skickad till bokföring",
        data: invoiceData,
      },
      { status: 200 }
    );
  } catch (e: any) {
    return bad(e?.message ?? "Unknown error", 500);
  }
}
