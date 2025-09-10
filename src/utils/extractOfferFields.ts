// Gemensam utility för att extrahera fält från offerttext
// Återanvänder logik från kundkortet

export interface ExtractedOfferFields {
  // Kundinformation
  companyName: string;
  contactPerson: string;
  email: string;
  phone: string;
  address: string;
  zip: string;
  city: string;
  orgNr: string;
  country: string;
  
  // Offertinformation
  date: string;
  offerNumber: string;
  validity: string;
  
  // Ekonomi
  total: string;
  vat: string;
  vatAmount: string;
  
  // Övrigt
  notes: string;
  offerText: string;
  
  // Radartiklar (om de finns)
  items?: Array<{
    name: string;
    hours?: string;
    pricePerHour?: string;
    total?: string;
  }>;
}

// Hjälpare för parser
function normalize(s: string): string {
  return s
    .replace(/\u2011|\u2013|\u2014/g, "-")
    .replace(/\u00A0/g, " ")
    .replace(/[^\S\r\n]+/g, " ");
}

function formatZip(zip: string): string {
  const only = (zip || "").replace(/\D/g, "");
  if (only.length === 5) return `${only.slice(0, 3)} ${only.slice(3)}`;
  return (zip || "").trim();
}

// Extrahera datum och konvertera till ISO-format
function parseDate(dateStr: string): string {
  if (!dateStr) return "";
  
  // Om redan ISO-format
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr;
  }
  
  // Försök parsa svenska datumformat
  const formats = [
    /(\d{2})[-/.](\d{2})[-/.](\d{4})/, // DD-MM-YYYY
    /(\d{4})[-/.](\d{2})[-/.](\d{2})/, // YYYY-MM-DD
    /(\d{2})[-/.](\d{2})[-/.](\d{2})/, // DD-MM-YY
  ];
  
  for (const format of formats) {
    const match = dateStr.match(format);
    if (match) {
      let year, month, day;
      
      if (format === formats[0]) { // DD-MM-YYYY
        [, day, month, year] = match;
      } else if (format === formats[1]) { // YYYY-MM-DD
        [, year, month, day] = match;
      } else { // DD-MM-YY
        [, day, month, year] = match;
        year = parseInt(year) < 50 ? `20${year}` : `19${year}`;
      }
      
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
  }
  
  return dateStr; // Returnera som den är om vi inte kan parsa
}

// Extrahera giltighet i dagar
function parseValidity(validityStr: string): string {
  if (!validityStr) return "";
  
  const match = validityStr.match(/(\d+)\s*dagar?/i);
  return match ? match[1] : "";
}

// Extrahera totalsumma och moms
function parseAmounts(text: string): { total: string; vat: string; vatAmount: string } {
  const norm = normalize(text);
  
  // Totalsumma
  const totalMatch = norm.match(/(?:Totalt|Total|Summa)\s*:?\s*([0-9\s,.\-]+)/i);
  const total = totalMatch ? totalMatch[1].replace(/[^\d,.-]/g, '').replace(',', '.') : "";
  
  // Moms procent
  const vatMatch = norm.match(/(?:Moms|VAT)\s*\(?(\d+)%?\)?\s*:?\s*([0-9\s,.\-]+)/i);
  const vat = vatMatch ? vatMatch[1] : "";
  const vatAmount = vatMatch ? vatMatch[2].replace(/[^\d,.-]/g, '').replace(',', '.') : "";
  
  return { total, vat, vatAmount };
}

// Extrahera radartiklar från tabell
function parseItems(text: string): Array<{ name: string; hours?: string; pricePerHour?: string; total?: string }> {
  const lines = text.split('\n');
  const items: Array<{ name: string; hours?: string; pricePerHour?: string; total?: string }> = [];
  
  let inTable = false;
  let headerFound = false;
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Hitta tabellhuvud
    if (trimmed.includes('Tjänst') && trimmed.includes('Timmar') && trimmed.includes('Pris')) {
      inTable = true;
      headerFound = true;
      continue;
    }
    
    // Sluta vid nästa sektion
    if (headerFound && (trimmed.includes('Totalt') || trimmed.includes('Summa') || trimmed.includes('📄'))) {
      break;
    }
    
    // Parsa radartiklar
    if (inTable && headerFound && trimmed && !trimmed.includes('Tjänst')) {
      // Försök extrahera kolumner (separerade av flera mellanslag eller tab)
      const columns = trimmed.split(/\s{2,}|\t/).filter(col => col.trim());
      
      if (columns.length >= 2) {
        const item = {
          name: columns[0] || "",
          hours: columns[1] || "",
          pricePerHour: columns[2] || "",
          total: columns[3] || ""
        };
        items.push(item);
      }
    }
  }
  
  return items;
}

export function extractOfferFields(offerText: string): ExtractedOfferFields {
  try {
    const norm = normalize(offerText || "");
    
    const safeGet = (regex: RegExp): string => {
      const m = norm.match(regex);
      return (m && m[1] ? String(m[1]).trim() : "");
    };

    // Extrahera grundläggande fält
    const companyName = safeGet(/(?:Kund|Beställare|Företag|Kundnamn)\s*:?\s*(.+)/i);
    const rawDate = safeGet(/(?:Datum|Offertdatum)\s*:?\s*([0-9]{4}-[0-9]{2}-[0-9]{2}|[0-9]{2}[-/.][0-9]{2}[-/.][0-9]{2,4})/i);
    const date = parseDate(rawDate);
    
    const offerNumber = safeGet(/(?:Offert(?:nummer|\s*nr\.?)?|Offert-Nr\.?)\s*:?\s*([A-Za-z0-9\-_/]+)/i);
    
    const orgNr = safeGet(/(?:Org(?:\.|\s)?(?:nr|nummer)|Organisations(?:nummer|nr))\s*:?\s*([0-9\- ]{6,})/i) ||
                  safeGet(/(?:VAT|Momsregnr|VAT(?:\s*nr)?)\s*:?\s*([A-Za-z0-9\- ]{6,})/i);

    const address = safeGet(/(?:Adress|Gatuadress|Besöksadress)\s*:?\s*(.+)/i) ||
                   safeGet(/(?:Postadress)\s*:?\s*(.+)/i);

    const postrad = (() => {
      const a = norm.match(/(?:Postnr(?:\.|)|Postnummer|Postadress)\s*:?\s*([0-9]{3}\s?[0-9]{2}\s+[^\n]+)/i);
      if (a && a[1]) return a[1];
      const b = norm.match(/([0-9]{3}\s?[0-9]{2})\s+([A-Za-zÅÄÖåäö\- ]{2,})/);
      if (b && b[0]) return b[0];
      return "";
    })();

    const phone = safeGet(/(?:Telefon|Tel\.?|Tel)\s*:?\s*([\d +\-()]{5,})/i);
    const email = safeGet(/(?:E-?post|E ?post|E-mail|Mail)\s*:?\s*([^\s,;<>]+@[^\s,;<>]+)/i);
    const contactPerson = safeGet(/(?:Kontaktperson|Kontakt)\s*:?\s*([^\n]+)/i);
    const country = safeGet(/(?:Land|Country)\s*:?\s*([^\n]+)/i) || "Sverige";

    // Parsa adress
    let street = address || "";
    let zip = "";
    let city = "";

    if (address) {
      const parts = address.split(",").map((s) => s.trim()).filter(Boolean);
      if (parts.length >= 2) {
        street = parts[0];
        const lastPart = parts[parts.length - 1];
        const zipMatch = lastPart.match(/([0-9]{3}\s?[0-9]{2})\s*(.+)/);
        if (zipMatch) {
          zip = formatZip(zipMatch[1]);
          city = zipMatch[2];
        } else {
          city = lastPart;
        }
      }
    }

    if (postrad) {
      const zipMatch = postrad.match(/([0-9]{3}\s?[0-9]{2})\s*(.+)/);
      if (zipMatch) {
        zip = formatZip(zipMatch[1]);
        city = zipMatch[2];
      }
    }

    // Extrahera giltighet
    const validityText = safeGet(/(?:Giltig|Giltighet)\s*:?\s*([^\n]+)/i);
    const validity = parseValidity(validityText);

    // Extrahera ekonomiska uppgifter
    const { total, vat, vatAmount } = parseAmounts(norm);

    // Extrahera radartiklar
    const items = parseItems(norm);

    // Samla anteckningar (GDPR, betalvillkor, etc.)
    const notesParts = [];
    const gdprMatch = norm.match(/(?:GDPR|Dataskyddsförordningen)[^\n]*(?:\n[^\n]*)*/i);
    if (gdprMatch) notesParts.push(gdprMatch[0]);
    
    const paymentMatch = norm.match(/(?:Betalvillkor|Betalning)[^\n]*(?:\n[^\n]*)*/i);
    if (paymentMatch) notesParts.push(paymentMatch[0]);
    
    const rotMatch = norm.match(/(?:ROT|RUT)[^\n]*(?:\n[^\n]*)*/i);
    if (rotMatch) notesParts.push(rotMatch[0]);

    const notes = notesParts.join('\n\n');

    return {
      companyName,
      contactPerson,
      email,
      phone,
      address: street,
      zip,
      city,
      orgNr,
      country,
      date,
      offerNumber,
      validity,
      total,
      vat,
      vatAmount,
      notes,
      offerText: offerText,
      items: items.length > 0 ? items : undefined
    };

  } catch (error) {
    console.error('Error extracting offer fields:', error);
    return {
      companyName: "",
      contactPerson: "",
      email: "",
      phone: "",
      address: "",
      zip: "",
      city: "",
      orgNr: "",
      country: "Sverige",
      date: "",
      offerNumber: "",
      validity: "",
      total: "",
      vat: "",
      vatAmount: "",
      notes: "",
      offerText: offerText
    };
  }
}

