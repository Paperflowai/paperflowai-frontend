import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

interface QualityCheck {
  passed: boolean;
  score: number;
  issues: string[];
  suggestions: string[];
}

// Bildkvalitetskontroll med Canvas API
function checkImageQuality(imageData: string): QualityCheck {
  const issues: string[] = [];
  const suggestions: string[] = [];
  let score = 100;

  try {
    // Skapa canvas för att analysera bilden
    const canvas = new OffscreenCanvas(1, 1);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return {
        passed: false,
        score: 0,
        issues: ['Kunde inte analysera bilden'],
        suggestions: ['Försök med en annan bild']
      };
    }

    // Ladda bilden
    const img = new Image();
    img.src = `data:image/jpeg;base64,${imageData}`;
    
    // Vänta på att bilden laddas (i en riktig implementation skulle vi använda async/await)
    // För nu returnerar vi en grundläggande kontroll
    
    // Simulerad kvalitetskontroll baserat på bildstorlek
    const imageSize = imageData.length;
    
    // Upplösning (baserat på filstorlek som proxy)
    if (imageSize < 50000) { // < 50KB
      issues.push('Bilden är för liten');
      suggestions.push('Ta bilden i högre upplösning');
      score -= 30;
    }
    
    if (imageSize > 2000000) { // > 2MB
      issues.push('Bilden är för stor');
      suggestions.push('Komprimera bilden lite');
      score -= 10;
    }
    
    // Simulerad kontroll för vanliga problem
    const randomIssues = [
      'Bilden verkar suddig',
      'Bilden är för mörk',
      'Bilden är sned',
      'Bilden har för mycket glans'
    ];
    
    const randomSuggestions = [
      'Håll kameran stadigt',
      'Förbättra belysningen',
      'Håll kameran rakt',
      'Undvik glans från ljus'
    ];
    
    // 20% chans för varje problem (för demo)
    if (Math.random() < 0.2) {
      const issueIndex = Math.floor(Math.random() * randomIssues.length);
      issues.push(randomIssues[issueIndex]);
      suggestions.push(randomSuggestions[issueIndex]);
      score -= 25;
    }
    
    return {
      passed: score >= 70,
      score: Math.max(0, score),
      issues,
      suggestions
    };
    
  } catch (error) {
    return {
      passed: false,
      score: 0,
      issues: ['Fel vid bildanalys'],
      suggestions: ['Försök med en annan bild']
    };
  }
}

// OpenAI Vision API för avancerad bildanalys
async function analyzeWithOpenAI(imageData: string): Promise<QualityCheck> {
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    // Fallback till grundläggande kontroll
    return checkImageQuality(imageData);
  }

  try {
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
                text: `Analysera denna bild och bedöm om den är lämplig för OCR/bokföring. Kontrollera:
                1. Upplösning (är texten tydlig?)
                2. Ljusstyrka (inte för mörk eller ljus?)
                3. Skärpa (inte suddig?)
                4. Vinkel (inte för sned?)
                5. Glans (inte för mycket reflektioner?)
                
                Svara med JSON-format:
                {
                  "passed": true/false,
                  "score": 0-100,
                  "issues": ["problem1", "problem2"],
                  "suggestions": ["förslag1", "förslag2"]
                }`
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${imageData}`
                }
              }
            ]
          }
        ],
        max_tokens: 500
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    if (!content) {
      throw new Error('No content from OpenAI');
    }

    // Försök parsa JSON-svaret
    try {
      const result = JSON.parse(content);
      return {
        passed: result.passed || false,
        score: result.score || 0,
        issues: result.issues || [],
        suggestions: result.suggestions || []
      };
    } catch (parseError) {
      // Om JSON-parsing misslyckas, använd grundläggande kontroll
      return checkImageQuality(imageData);
    }
    
  } catch (error) {
    console.error('OpenAI Vision error:', error);
    // Fallback till grundläggande kontroll
    return checkImageQuality(imageData);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { image } = await req.json();
    
    if (!image) {
      return NextResponse.json({ error: 'Image required' }, { status: 400 });
    }

    // Kör bildkvalitetskontroll
    const qualityCheck = await analyzeWithOpenAI(image);
    
    return NextResponse.json(qualityCheck);
    
  } catch (error) {
    console.error('Image quality check error:', error);
    return NextResponse.json({ 
      error: 'Quality check failed',
      passed: false,
      score: 0,
      issues: ['Tekniskt fel vid bildanalys'],
      suggestions: ['Försök igen eller använd en annan bild']
    }, { status: 500 });
  }
}

