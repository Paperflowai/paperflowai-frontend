import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { image } = await req.json();
    
    if (!image) {
      return NextResponse.json({ error: 'Image required' }, { status: 400 });
    }

    // Kontrollera om Google Cloud Vision API key finns
    const apiKey = process.env.GOOGLE_CLOUD_VISION_API_KEY;
    
    if (!apiKey) {
      // Fallback till mock-svar om ingen API key
      return NextResponse.json({ 
        text: 'Mock OCR: Faktura från ICA, 1250 kr, 25% moms, 2024-01-15',
        mock: true 
      });
    }

    // Anropa Google Cloud Vision API
    const response = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: [{
            image: { content: image },
            features: [{ type: 'TEXT_DETECTION', maxResults: 1 }]
          }]
        })
      }
    );

    if (!response.ok) {
      throw new Error(`Vision API error: ${response.status}`);
    }

    const data = await response.json();
    const text = data.responses?.[0]?.textAnnotations?.[0]?.description || '';
    
    return NextResponse.json({ text });
    
  } catch (error) {
    console.error('Vision OCR error:', error);
    return NextResponse.json({ 
      error: 'OCR failed',
      text: 'Kunde inte läsa text från bilden'
    }, { status: 500 });
  }
}

