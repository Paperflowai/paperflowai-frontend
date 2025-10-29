import { NextResponse } from "next/server";

export const runtime = "nodejs";

type CreateFromGptBody = {
  customerId: string;
  jsonData: any;
  textData?: string;
};

function bad(msg: string, code = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status: code });
}

function toNumber(v: any): number | undefined {
  const n = Number(v);
  return isFinite(n) ? n : undefined;
}

function computeAmountFromRows(rows: any[]): number | undefined {
  try {
    if (!Array.isArray(rows)) return undefined;
    const total = rows.reduce((sum, r) => {
      const timmar = Number(r?.timmar ?? r?.hours ?? 0);
      const pris = Number(r?.pris_per_timme ?? r?.price_per_hour ?? 0);
      return sum + (isFinite(timmar) && isFinite(pris) ? timmar * pris : 0);
    }, 0);
    return isFinite(total) ? Math.round(total * 100) / 100 : undefined;
  } catch {
    return undefined;
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as CreateFromGptBody;
    const { customerId, jsonData } = body;

    if (!customerId || !jsonData) {
      return bad("Missing required fields: customerId, jsonData");
    }

    // Map GPT JSON → unified docs/create payload
    const kund = jsonData.kund || {};
    const foretag = jsonData.foretag || {};
    const rows = jsonData.rader || jsonData.rows || [];

    const amount = toNumber(jsonData.summa) ?? computeAmountFromRows(rows) ?? 0;
    const currency = jsonData.valuta || jsonData.currency || "SEK";
    const title = jsonData.titel || jsonData.title || "Offert";

    const payload = {
      document_type: "offer" as const,
      customerId,
      title,
      amount,
      currency,
      customer: {
        name: kund.namn ?? kund.name ?? undefined,
        orgnr: kund.orgnr ?? foretag.orgnr ?? undefined,
        email: kund.epost ?? kund.email ?? undefined,
        phone: kund.telefon ?? kund.phone ?? undefined,
        address: kund.adress ?? kund.address ?? undefined,
        zip: kund.postnummer ?? kund.zip ?? undefined,
        city: kund.ort ?? kund.city ?? undefined,
        country: kund.land ?? kund.country ?? "Sverige",
      },
      dataJson: jsonData,
    };

    const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/docs/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({ ok: false }));
    if (!res.ok || !data?.ok) {
      return bad(data?.error || `Failed to create via docs/create (HTTP ${res.status})`, 500);
    }

    return NextResponse.json({ ok: true, result: data });
  } catch (error) {
    console.error("Create-from-GPT error:", error);
    return bad(`Server error: ${error instanceof Error ? error.message : String(error)}`);
  }
}
