import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

// Funktion för att anropa din anpassade offert-GPT
async function generateCustomOffer(requirements: string, customer: any) {
  try {
    // Här skulle du anropa din anpassade offert-GPT API
    // För nu simulerar vi svaret baserat på din GPT-struktur
    
    const offerNumber = `OFF-${new Date().getFullYear()}-${Math.floor(Math.random() * 9999).toString().padStart(4, '0')}`;
    const totalAmount = calculateTotal(requirements);
    
    // JSON-delen med alla kund- och offertfält
    const jsonData = {
      offertnummer: offerNumber,
      datum: new Date().toISOString().split('T')[0],
      titel: `Offert för ${requirements}`,
      summa: totalAmount,
      valuta: "SEK",
      kund: {
        namn: customer?.companyName || "Ny kund",
        orgnr: customer?.orgNr || "",
        kontaktperson: customer?.contactPerson || "",
        epost: customer?.email || "",
        telefon: customer?.phone || "",
        adress: customer?.address || "",
        postnummer: customer?.zip || "",
        ort: customer?.city || "",
        befattning: customer?.role || "",
        land: customer?.country || "Sverige"
      }
    };
    
    // Text-delen med offertlayouten för PDF
    const offerText = `🧾 Offertinnehåll

[LOGOTYP HÄR]

OFFERT

Kund: ${customer?.companyName || "Ny kund"}
Datum: ${new Date().toLocaleDateString('sv-SE')}
Offertnummer: ${offerNumber}

Kundinformation:
Org.nr: ${customer?.orgNr || "[Org.nr saknas]"}
Adress: ${customer?.address || "[Adress saknas]"}
Kontaktperson: ${customer?.contactPerson || "Kontaktperson"}
Telefon: ${customer?.phone || "Telefon saknas"}
E-post: ${customer?.email || "E-post saknas"}

Tjänster:
${generateServiceTable(requirements)}

Totalsumma: ${totalAmount} SEK exkl. moms

Betalningsvillkor:
Betaltid: 30 dagar
Dröjsmålsränta: 8% enligt räntelagen
Fakturamottagare: faktura@example.se
Bankgiro: 123-4567
Notis: Moms tillkommer

GDPR:
Vi hanterar kunduppgifter enligt Dataskyddsförordningen (GDPR). Personuppgifter används endast för att uppfylla avtal, hantera fakturering och kundkontakt.

Giltighet:
Denna offert är giltig i 30 dagar från utskriftsdatum. Priser anges exklusive moms.

Signatur:
[Namn och e-post på undertecknare]`;

    // Kombinera JSON och text för att simulera GPT-svar
    const gptResponse = JSON.stringify(jsonData) + "\n\n" + offerText;
    
    return {
      json: jsonData,
      text: offerText,
      gptResponse: gptResponse, // Kombinerat svar för handleGptResponse
      metadata: {
        offerNumber: offerNumber,
        date: new Date().toISOString().split('T')[0],
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        currency: "SEK",
        vatRate: 0.25
      },
      items: generateServiceItems(requirements),
      totals: {
        subtotalExVat: totalAmount,
        vatAmount: totalAmount * 0.25,
        totalIncVat: totalAmount * 1.25
      },
      uncertainties: [],
      customGPT: true
    };
  } catch (error) {
    console.error('Custom offer generation error:', error);
    throw new Error('Kunde inte generera anpassad offert');
  }
}

function generateServiceTable(requirements: string): string {
  const services = getServicesForRequirements(requirements);
  let table = "Tjänst | Timmar | Pris/tim | Totalt\n";
  table += "-------|--------|----------|-------\n";
  
  services.forEach(service => {
    table += `${service.description} | ${service.hours} | ${service.pricePerHour} | ${service.total}\n`;
  });
  
  return table;
}

function generateServiceItems(requirements: string) {
  const services = getServicesForRequirements(requirements);
  return services.map(service => ({
    description: service.description,
    qty: service.hours,
    unit: "tim",
    unitPriceExVat: service.pricePerHour,
    lineTotalExVat: service.total
  }));
}

function getServicesForRequirements(requirements: string) {
  const lowerReq = requirements.toLowerCase();
  
  if (lowerReq.includes('webbutveckling') || lowerReq.includes('web')) {
    return [
      { description: "Systemanalys – Behovsanalys & dokumentation", hours: 20, pricePerHour: 1200, total: 24000 },
      { description: "Frontend utveckling – React/Next.js", hours: 40, pricePerHour: 1200, total: 48000 },
      { description: "Backend utveckling – API & databas", hours: 30, pricePerHour: 1200, total: 36000 },
      { description: "SEO-optimering & prestanda", hours: 10, pricePerHour: 1000, total: 10000 }
    ];
  } else if (lowerReq.includes('app') || lowerReq.includes('mobil')) {
    return [
      { description: "App-design & UX/UI", hours: 25, pricePerHour: 1200, total: 30000 },
      { description: "Mobilapp utveckling – React Native", hours: 50, pricePerHour: 1200, total: 60000 },
      { description: "Backend integration", hours: 20, pricePerHour: 1200, total: 24000 },
      { description: "App Store optimering", hours: 8, pricePerHour: 1000, total: 8000 }
    ];
  } else {
    return [
      { description: "Konsultation och utveckling", hours: 20, pricePerHour: 1200, total: 24000 }
    ];
  }
}

function calculateTotal(requirements: string): number {
  const services = getServicesForRequirements(requirements);
  return services.reduce((sum, service) => sum + service.total, 0);
}

export async function GET() {
  return NextResponse.json({ ok: true, pong: "PONG" });
}

export async function POST(req: NextRequest) {
  try {
    let body;
    try {
      body = await req.json();
    } catch (jsonError) {
      console.error('JSON parsing error:', jsonError);
      return NextResponse.json({ 
        ok: false, 
        error: 'Ogiltig JSON i förfrågan' 
      }, { status: 400 });
    }
    
    const { mode, payload, messages, systemPrompt } = body;

    if (mode === "passthrough") {
      // Äkta pass-through till OpenAI med din systemprompt
      let retries = 3;
      
      while (retries > 0) {
        try {
          const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'gpt-3.5-turbo', // Fallback till billigare modell
              messages: [
                { role: 'system', content: systemPrompt },
                ...messages
              ],
              temperature: 0.7,
              top_p: 1,
              max_tokens: 2000, // Mindre för 3.5-turbo
              stream: false
            })
          });

          if (response.status === 429) {
            // Rate limit - vänta och försök igen
            const waitTime = Math.pow(2, 4 - retries) * 1000; // Exponential backoff
            console.log(`Rate limited, waiting ${waitTime}ms before retry ${4 - retries}/3`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            retries--;
            continue;
          }

          if (!response.ok) {
            const errorText = await response.text();
            console.error(`OpenAI API error ${response.status}:`, errorText);
            
            if (response.status === 401) {
              throw new Error('OpenAI API-nyckel är ogiltig eller saknas');
            } else if (response.status === 402) {
              throw new Error('OpenAI API-konto har slut på krediter');
            } else if (response.status === 429) {
              throw new Error('För många förfrågningar till OpenAI. Vänta en stund och försök igen.');
            } else {
              throw new Error(`OpenAI API-fel: ${response.status}`);
            }
          }

          let data;
          try {
            data = await response.json();
          } catch (jsonError) {
            console.error('OpenAI response JSON parsing error:', jsonError);
            throw new Error('OpenAI returnerade ogiltigt JSON-svar');
          }
          
          const aiResponse = data.choices?.[0]?.message?.content || 'Inget svar från AI';

          return NextResponse.json({
            ok: true,
            text: aiResponse
          });
        } catch (error) {
          if (retries === 1) {
            throw error;
          }
          retries--;
          const waitTime = Math.pow(2, 4 - retries) * 1000;
          console.log(`Error occurred, waiting ${waitTime}ms before retry ${4 - retries}/3`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
      
      // Om vi kommer hit har alla retries misslyckats
      throw new Error('Alla försök misslyckades. Försök igen senare.');
    } else if (mode === "offer") {
      // Använd din anpassade offert-GPT
      const { notes, customer } = payload;
      const requirements = notes || "Standard webbutveckling";
      
      // Simulera anrop till din anpassade offert-GPT
      // Här skulle du normalt anropa din offert-GPT API
      const customOfferResponse = await generateCustomOffer(requirements, customer);
      
      return NextResponse.json({ 
        ok: true, 
        data: customOfferResponse,
        gptResponse: customOfferResponse.gptResponse // Inkludera för handleGptResponse
      });

    } else if (mode === "chat") {
      // Mock chat svar
      const message = payload.message?.toLowerCase() || '';
      
      let response = "Jag förstår din fråga. Jag kan hjälpa dig med offertgenerering, kundhantering och bokföring.";
      
      if (message.includes('hej') || message.includes('hello') || message.includes('hi')) {
        response = "Hej! Jag är din AI-assistent för företagsadministration. Jag kan hjälpa dig skapa offerter, hantera kunder och bokföring. Vad kan jag hjälpa dig med idag?";
      } else if (message.includes('hjälp') || message.includes('help')) {
        response = "Jag kan hjälpa dig med:\n\n• **Offertgenerering** - Skapa professionella offerter\n• **Kundhantering** - Hantera kundinformation\n• **Bokföring** - Organisera dina ekonomiska transaktioner\n\nVad behöver du hjälp med?";
      } else if (message.includes('offert') || message.includes('skapa')) {
        response = "Jag kan hjälpa dig skapa offerter! Skriv till exempel:\n\n• 'skapa en offert för webbutveckling'\n• 'generera offert för mobilapp'\n• 'offert för e-handelsplattform'\n\nSå skapar jag en komplett offert åt dig som du kan spara till kundkortet.";
      } else if (message.includes('kund') || message.includes('customer')) {
        response = "För att hantera kunder kan du:\n\n• Gå till kundregistret för att se alla kunder\n• Skapa nya kunder med kontaktinformation\n• Spara offerter direkt till kundkortet\n\nVill du att jag hjälper dig skapa en offert för en specifik kund?";
      } else if (message.includes('bokföring') || message.includes('bookkeeping')) {
        response = "Bokföringsfunktionerna inkluderar:\n\n• Fotografera kvitton för automatisk OCR\n• Organisera transaktioner per kategori\n• Generera rapporter och översikter\n\nVill du att jag visar dig hur du använder foto-funktionen för kvitton?";
      } else if (message.includes('tack') || message.includes('thanks')) {
        response = "Varsågod! Jag är här för att hjälpa dig. Finns det något annat jag kan assistera dig med?";
      } else if (message.includes('vad') || message.includes('what')) {
        response = "Jag är en AI-assistent specialiserad på företagsadministration. Jag kan hjälpa dig med offertgenerering, kundhantering och bokföring. Vad skulle du vilja veta mer om?";
      } else {
        response = "Jag förstår din fråga. Som din AI-assistent kan jag hjälpa dig med offertgenerering, kundhantering och bokföring. Kan du vara mer specifik om vad du behöver hjälp med?";
      }

      return NextResponse.json({ ok: true, text: response });

    } else {
      return NextResponse.json({ ok: false, error: "Invalid mode specified." }, { status: 400 });
    }
  } catch (error) {
    console.error('GPT API error:', error);
    return NextResponse.json({ 
      ok: false, 
      error: `Ett fel uppstod: ${error instanceof Error ? error.message : String(error)}` 
    }, { status: 500 });
  }
}