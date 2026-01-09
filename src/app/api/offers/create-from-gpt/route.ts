import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";
import crypto from "crypto";
import { buildDocument } from "@/lib/pdf/buildDocument";
// ----------------------------------------------------
// HJÄLPFUNKTIONER – Förhindrar att datum hamnar som företagsnamn
// ----------------------------------------------------

const monthNames = [
  "januari", "februari", "mars", "april", "maj", "juni",
  "juli", "augusti", "september", "oktober", "november", "december",
];

function looksLikeDate(text: string): boolean {
  if (!text) return false;
  const t = text.trim().toLowerCase();

  // Format: 2026-01-03
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return true;

  // Format: 3 januari 2026
  if (/^\d{1,2}\s+[a-zåäö]+\.?\s+\d{4}$/.test(t)) return true;

  // Om texten innehåller en månad + år → troligt datum
  if (monthNames.some((m) => t.includes(m)) && /\d{4}/.test(t)) {
    return true;
  }

  return false;
}

function cleanText(value: any): string | null {
  if (value === null || value === undefined) return null;

  const t = String(value).trim();
  if (!t) return null;

  if (looksLikeDate(t)) {
    console.log(`[cleanText] 🚫 Datum filtrerat bort: "${t}"`);
    return null;
  }

  return t;
}

// Hämta företagsnamn (nu rensat från datum)
function getCompanyName(kund: any, safeJson: any): string {
  // Testa alla möjliga fält i prioritetsordning
  const candidates = [
    { field: 'kund.namn', value: cleanText(kund?.namn) },
    { field: 'kund.name', value: cleanText(kund?.name) },
    { field: 'kund.foretag', value: cleanText(kund?.foretag) },
    { field: 'kund.company', value: cleanText(kund?.company) },
    { field: 'kund.companyName', value: cleanText(kund?.companyName) },
    { field: 'safeJson.kundnamn', value: cleanText(safeJson?.kundnamn) },
    { field: 'safeJson.foretag', value: cleanText(safeJson?.foretag) },
    { field: 'safeJson.company', value: cleanText(safeJson?.company) },
    { field: 'safeJson.companyName', value: cleanText(safeJson?.companyName) },
  ];

  console.log("[getCompanyName] 🔍 Testade fält:", candidates);

  // Använd ?? (nullish coalescing) istället för || (logical OR)
  // Detta kollar bara null/undefined, inte tomma strängar
  const result = (
    cleanText(kund?.namn) ??
    cleanText(kund?.name) ??
    cleanText(kund?.foretag) ??
    cleanText(kund?.company) ??
    cleanText(kund?.companyName) ??
    cleanText(safeJson?.kundnamn) ??
    cleanText(safeJson?.foretag) ??
    cleanText(safeJson?.company) ??
    cleanText(safeJson?.companyName) ??
    "Ny kund"
  );

  console.log("[getCompanyName] ✅ Slutresultat:", result);

  // Varning om vi hamnade på fallback
  if (result === "Ny kund") {
    console.warn("[getCompanyName] ⚠️ Inget företagsnamn hittades! Alla fält var null/datum.");
  }

  return result;
}

export const runtime = "nodejs";

type GPTOfferBody = {
  customerId?: string;      // kan saknas vid ny kund
  jsonData?: any;
  textData: string;
};

// CORS headers for GPT Actions
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function bad(msg: string, code = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status: code, headers: corsHeaders });
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as GPTOfferBody;
    let { customerId, jsonData, textData } = body;

    if (!textData) {
      return bad("Missing textData");
    }

    const safeJson = jsonData || {};
    const kund = safeJson.kund || safeJson.customer || {};

    // 🔍 DEBUG: Logga vad GPT faktiskt skickar
    console.log("[create-from-gpt] 📦 Raw jsonData:", JSON.stringify(jsonData, null, 2));
    console.log("[create-from-gpt] 👤 kund-object:", JSON.stringify(kund, null, 2));

    let companyName = getCompanyName(kund, safeJson);

    // 🔄 Om jsonData innehåller "Namn, Företag AB" → splitta och ta företagsnamnet
    if (companyName && companyName.includes(',')) {
      const parts = companyName.split(',').map(p => p.trim());
      // Anta att företagsnamnet kommer efter kommatecknet och innehåller AB/HB/KB
      const companyPart = parts.find(p => /\b(AB|HB|KB|Aktiebolag)\b/i.test(p));
      if (companyPart) {
        companyName = companyPart;
        console.log("[create-from-gpt] ✅ Extraherade företagsnamn från komma-separerad sträng:", companyName);
      } else {
        // Fallback: ta sista delen efter komma
        companyName = parts[parts.length - 1];
        console.log("[create-from-gpt] ✅ Tog sista delen efter komma:", companyName);
      }
    }

    // 🆕 Om jsonData är tomt/saknas → extrahera från textData
    if (companyName === "Ny kund" && textData) {
      console.log("[create-from-gpt] ⚠️ jsonData saknar företagsnamn - försöker extrahera från textData...");

      // Sök efter företagsnamn i olika format
      // Format 1: "Företag: XYZ AB"
      let kundMatch = textData.match(/(?:Företag|Company):\s*([^\n]+)/i);

      // Format 2: "Till:\nXYZ AB" (namn på nästa rad efter Till:)
      if (!kundMatch) {
        kundMatch = textData.match(/Till:\s*\n\s*([^\n]+)/i);
      }

      if (kundMatch) {
        const extractedName = cleanText(kundMatch[1]);
        if (extractedName && !looksLikeDate(extractedName)) {
          companyName = extractedName;
          console.log("[create-from-gpt] ✅ Extraherade företagsnamn från textData:", companyName);
        }
      }
    }

    console.log("[create-from-gpt] 🏢 Resultat companyName:", companyName);

    // 🛡️ EXTRA SÄKERHET: Om vi fick "Ny kund", försök hitta NÅGOT namn
    if (companyName === "Ny kund") {
      console.warn("[create-from-gpt] ⚠️ Fick 'Ny kund' - försöker hitta alternativt namn...");

      // Sök i alla toppnivå-fält i jsonData
      const alternativeNames = [
        safeJson.namn,
        safeJson.name,
        safeJson.företag,
        safeJson.foretag,
        safeJson.company,
        kund.företag,
      ].map(v => cleanText(v)).filter(v => v !== null);

      if (alternativeNames.length > 0) {
        companyName = alternativeNames[0]!;
        console.log("[create-from-gpt] ✅ Hittade alternativt namn:", companyName);
      } else {
        console.error("[create-from-gpt] ❌ VARNING: Inget företagsnamn hittades i jsonData!");
      }
    }


    let contactPerson =
      kund.kontaktperson ??
      kund.contactperson ??
      kund.contactPerson ??
      null;

    // Om kontaktperson saknas MEN kund.namn innehåller komma, extrahera person från där
    if (!contactPerson && kund?.namn && typeof kund.namn === 'string' && kund.namn.includes(',')) {
      const parts = kund.namn.split(',').map(p => p.trim());
      // Första delen är förmodligen kontaktperson (om den inte innehåller AB/HB/KB)
      const personPart = parts.find(p => !/\b(AB|HB|KB|Aktiebolag)\b/i.test(p));
      if (personPart) {
        contactPerson = personPart;
        console.log("[create-from-gpt] 👤 Extraherade kontaktperson från kund.namn:", contactPerson);
      }
    }

    let role = null; // Befattning/titel (VD, Projektledare, etc.)

    let email =
      kund.epost ??
      kund.email ??
      null;

    let phone =
      kund.telefon ??
      kund.phone ??
      null;

    let address =
      kund.adress ??
      kund.address ??
      null;

    let zip =
      kund.postnummer ??
      kund.postnr ??
      kund.zip ??
      null;

    let city =
      kund.ort ??
      kund.city ??
      kund.stad ??
      null;

    let orgNr =
      kund.orgnr ??
      kund.org_nr ??
      null;

    const country =
      kund.land ??
      kund.country ??
      "Sverige";

    // 🆕 Om jsonData är tom → extrahera även kontaktuppgifter från textData
    if ((!email || !phone || !contactPerson) && textData) {
      console.log("[create-from-gpt] ℹ️ Extraherar kontaktuppgifter från textData...");

      // E-post (flera format)
      if (!email) {
        const emailMatch = textData.match(/(?:E-post|Email|E-mail)?:?\s*([^\n\s]+@[^\n\s]+)/i);
        if (emailMatch) {
          email = emailMatch[1].trim();
          console.log("[create-from-gpt] 📧 Hittade e-post:", email);
        }
      }

      // Telefon
      if (!phone) {
        const phoneMatch = textData.match(/(?:Telefon|Tel|Phone):\s*([^\n]+)/i);
        if (phoneMatch) {
          phone = phoneMatch[1].trim();
          console.log("[create-from-gpt] 📞 Hittade telefon:", phone);
        }
      }

      // Org.nr
      if (!orgNr) {
        const orgNrMatch = textData.match(/(?:Org\.?nr|Organisationsnummer):\s*([0-9\-]+)/i);
        if (orgNrMatch) {
          orgNr = orgNrMatch[1].trim();
          console.log("[create-from-gpt] 🏢 Hittade org.nr:", orgNr);
        }
      }

      // Kontaktperson från textData
      if (!contactPerson) {
        // Format 1: "Kontaktperson: Anna Sjöberg"
        let contactMatch = textData.match(/(?:Kontaktperson|Kontakt):\s*([^\n]+)/i);

        if (contactMatch) {
          contactPerson = contactMatch[1].trim();
          console.log("[create-from-gpt] 👤 Hittade kontaktperson:", contactPerson);
        } else {
          // Format 2: Efter företagsnamnet, rad med "Namn Efternamn, Befattning"
          const nameWithTitleMatch = textData.match(/Till:\s*\n[^\n]+\n([A-ZÅÄÖ][a-zåäö]+ [A-ZÅÄÖ][a-zåäö]+),\s*([^\n]+)/i);
          if (nameWithTitleMatch) {
            contactPerson = nameWithTitleMatch[1].trim();
            console.log("[create-from-gpt] 👤 Hittade kontaktperson (format 2):", contactPerson);

            // Spara befattning separat i role-fältet
            const title = nameWithTitleMatch[2].trim();
            if (title && title.length < 50) {
              role = title;
              console.log("[create-from-gpt] 💼 Hittade befattning:", role);
            }
          }
        }
      }

      // Om contactPerson kom från jsonData och innehåller komma, splitta den
      if (contactPerson && contactPerson.includes(',')) {
        const parts = contactPerson.split(',').map(p => p.trim());
        contactPerson = parts[0]; // Ta första delen (namnet)
        if (!role && parts[1]) {
          role = parts[1]; // Ta andra delen som befattning om den finns
          console.log("[create-from-gpt] 💼 Extraherade befattning från komma:", role);
        }
        console.log("[create-from-gpt] 👤 Rensat kontaktperson:", contactPerson);
      }

      // Adress med postnummer och ort (format: "Adress: Gatan 1, 123 45 Stad")
      if (!address || !zip || !city) {
        const fullAddressMatch = textData.match(/(?:Adress|Address):\s*([^,\n]+),\s*(\d{3}\s?\d{2})\s+([^\n]+)/i);
        if (fullAddressMatch) {
          if (!address) {
            address = fullAddressMatch[1].trim();
            console.log("[create-from-gpt] 🏠 Hittade adress:", address);
          }
          if (!zip) {
            zip = fullAddressMatch[2].trim();
            console.log("[create-from-gpt] 📮 Hittade postnummer:", zip);
          }
          if (!city) {
            city = fullAddressMatch[3].trim();
            console.log("[create-from-gpt] 🏙️ Hittade ort:", city);
          }
        } else if (!address) {
          // Fallback: bara gatuadress
          const simpleAddressMatch = textData.match(/(?:Adress|Address):\s*([^,\n]+)/i);
          if (simpleAddressMatch) {
            address = simpleAddressMatch[1].trim();
            console.log("[create-from-gpt] 🏠 Hittade adress:", address);
          }
        }
      }
    }

    let customerNumber =
      safeJson.offert?.offertnummer ??
      safeJson.offertnummer ??
      null;

    let contactDate =
      safeJson.offert?.datum ??
      safeJson.datum ??
      null;

    // Extrahera offertnummer och datum från textData om de saknas
    if (textData) {
      if (!customerNumber) {
        // Format 1: "OFF-2026-001" eller "OFF-2026-0001"
        let offerNumMatch = textData.match(/(?:Offertnummer|Offert-?nr):\s*(OFF-\d{4}-\d{3,4})/i);

        // Format 2: Bara "2026-001" utan "OFF-" prefix
        if (!offerNumMatch) {
          offerNumMatch = textData.match(/(?:Offertnummer|Offert-?nr):\s*(\d{4}-\d{3,4})/i);
        }

        if (offerNumMatch) {
          customerNumber = offerNumMatch[1].trim();
          console.log("[create-from-gpt] 📋 Hittade offertnummer:", customerNumber);
        }
      }

      if (!contactDate) {
        // Format 1: "2026-01-09" (ISO-format)
        let dateMatch = textData.match(/(?:Datum|Date):\s*(\d{4}-\d{2}-\d{2})/i);

        // Format 2: "9 januari 2026" (svensk text)
        if (!dateMatch) {
          const textDateMatch = textData.match(/(?:Datum|Date):\s*(\d{1,2})\s+(januari|februari|mars|april|maj|juni|juli|augusti|september|oktober|november|december)\s+(\d{4})/i);
          if (textDateMatch) {
            const day = textDateMatch[1].padStart(2, '0');
            const monthName = textDateMatch[2].toLowerCase();
            const year = textDateMatch[3];

            const monthMap: Record<string, string> = {
              januari: '01', februari: '02', mars: '03', april: '04',
              maj: '05', juni: '06', juli: '07', augusti: '08',
              september: '09', oktober: '10', november: '11', december: '12'
            };

            const month = monthMap[monthName];
            if (month) {
              contactDate = `${year}-${month}-${day}`;
              console.log("[create-from-gpt] 📅 Konverterade datum från text:", contactDate);
            }
          }
        } else {
          contactDate = dateMatch[1].trim();
          console.log("[create-from-gpt] 📅 Hittade datum:", contactDate);
        }
      }
    }

    // 🆕 Auto-generera kundnummer om det fortfarande saknas efter alla extraktioner
    if (!customerNumber) {
      const currentYear = new Date().getFullYear();

      // Räkna befintliga kunder för detta år (baserat på customer_number-format KND-YYYY-XXXX)
      const { data: existingCustomers, error: countError } = await supabaseAdmin
        .from("customers")
        .select("customer_number")
        .like("customer_number", `KND-${currentYear}-%`);

      if (countError) {
        console.warn("[create-from-gpt] Kunde inte räkna befintliga kundnummer:", countError.message);
      }

      const nextNumber = (existingCustomers?.length || 0) + 1;
      customerNumber = `KND-${currentYear}-${String(nextNumber).padStart(4, '0')}`;
      console.log("[create-from-gpt] 🔢 Auto-genererat kundnummer:", customerNumber);
    }

    // Sätt kund-ID
    if (!customerId) {
      // Kolla om kund med samma företagsnamn redan finns
      if (companyName && companyName !== "Ny kund" && companyName !== "OKÄNT FÖRETAG") {
        console.log("[create-from-gpt] 🔍 Söker efter befintlig kund med namn:", companyName);

        // Normalisera namn för bättre matchning (trimma, lowercase)
        const normalizedName = companyName.trim().toLowerCase();

        // Sök med exakt matchning först
        let { data: existingCustomer, error: searchError } = await supabaseAdmin
          .from("customers")
          .select("id")
          .eq("company_name", companyName)
          .limit(1)
          .maybeSingle();

        // Om inte hittat, försök case-insensitive sökning
        if (!existingCustomer && !searchError) {
          const { data: customers } = await supabaseAdmin
            .from("customers")
            .select("id, company_name")
            .ilike("company_name", companyName);

          if (customers && customers.length > 0) {
            existingCustomer = customers[0];
            console.log("[create-from-gpt] 🔍 Hittade via case-insensitive:", existingCustomer.id);
          }
        }

        if (existingCustomer) {
          customerId = existingCustomer.id;
          console.log("[create-from-gpt] ✅ Hittade befintlig kund:", customerId);
        } else {
          // Ny kund → skapa id
          customerId = crypto.randomUUID();
          console.log("[create-from-gpt] ➕ Skapar ny kund:", customerId);
        }
      } else {
        // Företagsnamn saknas eller är placeholder → skapa alltid ny
        customerId = crypto.randomUUID();
        console.log("[create-from-gpt] ➕ Skapar ny kund (okänt företagsnamn):", customerId);
      }
    } else {
      console.log("[create-from-gpt] 📝 Uppdaterar befintlig kund:", customerId);
    }

    // 4) Upsert i public.customers (gamla strukturen)
    const customerRow = {
      id: customerId,
      // Företagsnamn (companyName är redan rensat av getCompanyName)
      name: companyName,
      company_name: companyName,

      // Org.nr i båda varianterna
      orgnr: orgNr ?? null,
      org_nr: orgNr ?? null,

      // Kontaktperson
      contact_person: contactPerson ?? null,
      role: role ?? null,

      // Kontaktuppgifter / adress
      email: email ?? null,
      phone: phone ?? null,
      address: address ?? null,
      zip: zip ?? null,
      city: city ?? null,
      country: country ?? "Sverige",

      // Offert-info
      customer_number: customerNumber ?? null,
      contact_date: contactDate ?? null,

      updated_at: new Date().toISOString(),
    };

    console.log("[create-from-gpt] customerRow:", customerRow);

    const { error: customerError } = await supabaseAdmin
      .from("customers")
      .upsert(customerRow, { onConflict: "id" });

    if (customerError) {
      console.error("[create-from-gpt] Customer upsert error:", customerError);
      return bad("Customer upsert failed: " + customerError.message, 500);
    }

    console.log("[create-from-gpt] ✅ Customer data saved:", {
      customerId,
      companyName,
      email,
    });

    // 5) Upsert i public.customer_cards
    const customerDataCards = {
      customer_id: customerId,
      name: companyName,
      orgnr: orgNr ?? null,
      email: email ?? null,
      phone: phone ?? null,
      address: address ?? null,
    };

    const { error: cardsError } = await supabaseAdmin
      .from("customer_cards")
      .upsert(customerDataCards, { onConflict: "customer_id" });

    if (cardsError) {
      console.warn("[create-from-gpt] customer_cards upsert warning:", cardsError.message);
      // Fortsätt ändå - customer_cards är inte kritisk
    } else {
      console.log("[create-from-gpt] ✅ Customer cards saved");
    }

    // 6) Generera PDF
    const pdfBytes = await buildDocument(
      {
        customerId,
        title: safeJson.titel || "Offert",
        amount: safeJson.summa || 0,
        currency: safeJson.valuta || "SEK",
        needsPrint: false,
        data: { textData },
      },
      "offer"
    );

    // 7) Lagra PDF i Storage
    const docId = crypto.randomUUID();
    const bucket = "paperflow-files";
    const storagePath = `documents/${customerId}/offers/${docId}.pdf`;

    const { error: upErr } = await supabaseAdmin.storage
      .from(bucket)
      .upload(storagePath, pdfBytes, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (upErr) {
      return bad("Upload failed: " + upErr.message, 500);
    }

    const { data: pub } = supabaseAdmin.storage
      .from(bucket)
      .getPublicUrl(storagePath);

    if (!pub?.publicUrl) {
      return bad("Could not generate public URL", 500);
    }

    // 8) Spara rad i documents
    const { data: docRow, error: docErr } = await supabaseAdmin
      .from("documents")
      .insert({
        id: docId,
        customer_id: customerId,
        doc_type: "offer",
        type: "offer",
        filename: safeJson.titel || "Offert",
        storage_path: storagePath,
        file_url: pub.publicUrl,
        bucket,
        bucket_name: bucket,
        status: "created",
        created_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (docErr) {
      return bad("Insert failed: " + docErr.message, 500);
    }

    // 9) Spara själva offerten i offers-tabellen, inklusive file_url
    const { data: offerRow, error: offerErr } = await supabaseAdmin
      .from("offers")
      .insert({
        customer_id: customerId,
        company_name: companyName,
        status: "created",
        data: safeJson,
        created_at: new Date().toISOString(),
        currency: safeJson.valuta || "SEK",
        amount: safeJson.summa || null,
        file_url: pub.publicUrl,
        needs_print: false,
        payload: { textData },
      })
      .select("id")
      .single();

    if (offerErr) {
      return bad("Offer insert failed: " + offerErr.message, 500);
    }

    // Bygg customerData-objektet
    const customerData = {
      companyName,
      orgNr,
      contactPerson,
      email,
      phone,
      address,
      zip,
      city,
      country,
      customerNumber,
      contactDate,
    };

    console.log("[create-from-gpt] 📤 Skickar tillbaka customerData:", customerData);

    // Varning om companyName är "Ny kund" men andra fält finns
    if (companyName === "Ny kund" && (orgNr || contactPerson || email)) {
      console.warn("[create-from-gpt] ⚠️ VARNING: companyName är 'Ny kund' men andra kunduppgifter finns!");
      console.warn("[create-from-gpt] Detta kan betyda att GPT skickade datum istället för företagsnamn.");
    }

    return NextResponse.json(
      {
        ok: true,
        customerId,
        documentId: docRow.id,
        offerId: offerRow.id,
        pdfUrl: pub.publicUrl,
        // ✅ Inkludera customerData för autofyll på frontend
        customerData,
      },
      { status: 200, headers: corsHeaders }
    );
  } catch (e: any) {
    console.error("create-from-gpt error:", e);
    return bad(e?.message || "Unknown error", 500);
  }
}
