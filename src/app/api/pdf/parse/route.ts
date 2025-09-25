import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export async function POST(req: NextRequest) {
  try {
    const { textContent, filePath } = await req.json();

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "Du tolkar offert-text och returnerar en enhetlig JSON för dokument (offer).",
        },
        {
          role: "user",
          content: `Extrahera offertdata från texten. Returnera exakt JSON:
{
  "document_type": "offer",
  "customerId": "string",
  "title": "string",
  "amount": number,
  "currency": "SEK",
  "customer": {
    "id": "string (valfritt)",
    "name": "string",
    "email": "string",
    "address": "string",
    "zip": "string",
    "city": "string",
    "country": "Sverige"
  },
  "dataJson": {},
  "filePath": "string (valfritt)"
}

TEXT:
${textContent}`,
        },
      ],
      response_format: { type: "json_object" },
    });

    const parsed = JSON.parse(completion.choices[0].message.content!);
    // Ensure downstream compatibility: include dataJson for docs/create extraction paths
    if (!parsed.dataJson) {
      parsed.dataJson = { ...parsed };
    }
    // Normalize Swedish keys into dataJson.kund/foretag if needed
    if (!parsed.dataJson.kund && (parsed.customer || parsed.kund)) {
      parsed.dataJson.kund = parsed.customer || parsed.kund;
    }
    if (filePath && !parsed.filePath) parsed.filePath = filePath;

    return NextResponse.json({ ok: true, parsed });
  } catch (err) {
    console.error("parse error", err);
    return NextResponse.json({ ok: false, error: "Parsing failed" }, { status: 500 });
  }
}
