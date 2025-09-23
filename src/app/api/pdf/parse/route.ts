import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export async function POST(req: NextRequest) {
  try {
    const { textContent } = await req.json();

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "Du är en parser som extraherar offertdata från text och returnerar JSON enligt schema.",
        },
        {
          role: "user",
          content: `Extrahera följande från texten:\n${textContent}\n\nReturnera i format:\n{
            "customerId": "string",
            "title": "string",
            "amount": number,
            "currency": "SEK",
            "customer": {
              "name": "string",
              "email": "string",
              "address": "string",
              "zip": "string",
              "city": "string",
              "country": "Sverige"
            },
            "dataJson": {}
          }`,
        },
      ],
      response_format: { type: "json_object" },
    });

    const jsonOutput = completion.choices[0].message.content;
    return NextResponse.json({ ok: true, parsed: JSON.parse(jsonOutput!) });
  } catch (err) {
    console.error("parse error", err);
    return NextResponse.json({ ok: false, error: "Parsing failed" }, { status: 500 });
  }
}
