import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { image } = await req.json();
    
    if (!image) {
      return NextResponse.json({ error: 'Image required' }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      // Fallback till mock-svar om ingen API key
      return NextResponse.json({ 
        text: 'Mock OCR: Faktura från ICA, 1 250 kr, 25% moms, 2024-01-15, Kvittonr: 12345',
        mock: true 
      });
    }

    // Anropa OpenAI Vision API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4-vision-preview',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Extrahera all text från denna bild. Fokusera på:
                - Företagsnamn/leverantör
                - Datum
                - Belopp (inklusive moms)
                - Kvittonummer/fakturanummer
                - Adresser och kontaktuppgifter
                
                Svara med all text du kan läsa, en rad per rad.`
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${image}`
                }
              }
            ]
          }
        ],
        max_tokens: 1000
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || '';
    
    return NextResponse.json({ text });
    
  } catch (error) {
    console.error('OpenAI OCR error:', error);
    return NextResponse.json({ 
      error: 'OCR failed',
      text: 'Kunde inte läsa text från bilden'
    }, { status: 500 });
  }
}

