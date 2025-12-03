/**
 * Extract customer and offer information from PDF text
 * Used by /api/offers/parse to auto-fill customer card
 */

export interface ExtractedOfferFields {
  // Customer information
  companyName: string;
  orgNr: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  zip: string;
  city: string;
  country: string;

  // Offer metadata
  offerNumber: string;
  date: string;
  validity: string;

  // Financial information
  total: string;
  vat: string;
  vatAmount: string;

  // Line items (optional)
  items?: Array<{
    name: string;
    hours?: string;
    pricePerHour?: string;
    total?: string;
  }>;

  // Additional notes
  notes: string;
}

/**
 * Normalize text by replacing special characters and whitespace
 */
function normalize(text: string): string {
  return text
    .replace(/\u2011|\u2013|\u2014/g, '-') // Em/en dashes -> hyphen
    .replace(/\u00A0/g, ' ') // Non-breaking space -> space
    .replace(/[^\S\r\n]+/g, ' '); // Multiple spaces -> single space
}

/**
 * Format Swedish postal code (12345 -> 123 45)
 */
function formatZip(zip: string): string {
  const digitsOnly = (zip || '').replace(/\D/g, '');
  if (digitsOnly.length === 5) {
    return `${digitsOnly.slice(0, 3)} ${digitsOnly.slice(3)}`;
  }
  return (zip || '').trim();
}

/**
 * Safe regex extraction - returns matched group or empty string
 */
function safeExtract(text: string, regex: RegExp): string {
  const match = text.match(regex);
  return match && match[1] ? String(match[1]).trim() : '';
}

/**
 * Extract customer and offer fields from PDF text
 */
export function extractOfferFields(rawText: string): ExtractedOfferFields {
  const text = normalize(rawText || '');

  // ============ CUSTOMER INFORMATION ============

  // Company name
  const companyName =
    safeExtract(text, /(?:Kund|Beställare|Företag|Kundnamn|Till)\s*:?\s*(.+)/i) ||
    guessCompanyName(text);

  // Organization number
  const orgNr =
    safeExtract(text, /(?:Org(?:\.|\s)?(?:nr|nummer)|Organisations(?:nummer|nr))\s*:?\s*([0-9\- ]{6,})/i) ||
    safeExtract(text, /(?:VAT|Momsregnr|VAT(?:\s*nr)?)\s*:?\s*([A-Za-z0-9\- ]{6,})/i);

  // Contact person
  const contactPerson = safeExtract(text, /(?:Kontaktperson|Kontakt|Attn)\s*:?\s*([^\n]+)/i);

  // Phone
  const phone = safeExtract(text, /(?:Telefon|Tel\.?|Tel|Mobil)\s*:?\s*([\d +\-()]{5,})/i);

  // Email
  const email = safeExtract(text, /(?:E-?post|E ?post|E-mail|Mail)\s*:?\s*([^\s,;<>]+@[^\s,;<>]+)/i);

  // Address parsing
  const addressRaw = safeExtract(text, /(?:Adress|Gatuadress|Besöksadress|Postadress)\s*:?\s*(.+)/i);
  const postalLine = extractPostalLine(text);

  const { street, zip, city } = parseAddress(addressRaw, postalLine);

  // Country
  const country = safeExtract(text, /(?:Land|Country)\s*:?\s*([^\n]+)/i) || 'Sverige';

  // ============ OFFER METADATA ============

  // Offer number
  const offerNumber =
    safeExtract(text, /(?:Offert(?:nummer|\s*nr\.?)?|Offert-Nr\.?|Offertnr)\s*:?\s*([A-Za-z0-9\-_/]+)/i) ||
    safeExtract(text, /(?:Ref(?:erens)?|Ref\.?)\s*:?\s*([A-Za-z0-9\-_/]+)/i);

  // Date
  const date = safeExtract(
    text,
    /(?:Datum|Offertdatum|Date)\s*:?\s*([0-9]{4}-[0-9]{2}-[0-9]{2}|[0-9]{2}[-/.][0-9]{2}[-/.][0-9]{2,4})/i
  );

  // Validity period
  const validity =
    safeExtract(text, /(?:Giltighet|Giltig(?:\s*till)?|Valid(?:ity)?)\s*:?\s*([^\n]+)/i) ||
    safeExtract(text, /([0-9]+)\s*(?:dagar|dagars)/i);

  // ============ FINANCIAL INFORMATION ============

  // Total/Net amount (before VAT)
  const total =
    safeExtract(text, /(?:Totalt|Total|Summa|Netto|Subtotal)\s*:?\s*([0-9\s,\.]+(?:\s*kr)?)/i) ||
    safeExtract(text, /(?:Exkl\.?\s*moms|Utan\s*moms)\s*:?\s*([0-9\s,\.]+)/i);

  // VAT percentage
  const vat =
    safeExtract(text, /(?:Moms|VAT|Tax)\s*:?\s*([0-9]+)\s*%/i) ||
    safeExtract(text, /([0-9]+)\s*%\s*(?:moms|vat)/i) ||
    '25'; // Default Swedish VAT

  // VAT amount
  const vatAmount =
    safeExtract(text, /(?:Moms(?:belopp)?|VAT\s*(?:amount)?)\s*:?\s*([0-9\s,\.]+)/i) ||
    safeExtract(text, /(?:Inkl\.?\s*moms|Med\s*moms)\s*:?\s*([0-9\s,\.]+)/i);

  // ============ LINE ITEMS (OPTIONAL) ============

  const items = extractLineItems(text);

  // ============ NOTES ============

  const notes =
    safeExtract(text, /(?:Anteckningar|Notes|Kommentarer|Övrigt)\s*:?\s*([^\n]+)/i) ||
    safeExtract(text, /(?:Betalningsvillkor|Payment\s*terms)\s*:?\s*([^\n]+)/i);

  const result = {
    companyName,
    orgNr,
    contactPerson,
    phone,
    email,
    address: street,
    zip: zip ? formatZip(zip) : '',
    city,
    country,
    offerNumber,
    date,
    validity,
    total,
    vat,
    vatAmount,
    items,
    notes,
  };

  console.log("[extractOfferFields] result:", result);

  return result;
}

/**
 * Extract postal line (zip + city) from text
 */
function extractPostalLine(text: string): string {
  // Try explicit postal line
  const explicit = text.match(
    /(?:Postnr(?:\.|)|Postnummer|Postadress)\s*:?\s*([0-9]{3}\s?[0-9]{2}\s+[^\n]+)/i
  );
  if (explicit && explicit[1]) return explicit[1];

  // Try general pattern
  const general = text.match(/([0-9]{3}\s?[0-9]{2})\s+([A-Za-zÅÄÖåäö\- ]{2,})/);
  if (general && general[0]) return general[0];

  return '';
}

/**
 * Parse address into street, zip, and city components
 */
function parseAddress(
  addressRaw: string,
  postalLine: string
): { street: string; zip: string; city: string } {
  let street = addressRaw || '';
  let zip = '';
  let city = '';

  // If address contains comma-separated parts
  if (addressRaw) {
    const parts = addressRaw.split(',').map(s => s.trim()).filter(Boolean);

    if (parts.length >= 2) {
      street = parts[0];
      const tail = parts.slice(1).join(', ');

      // Try to extract zip + city from tail
      const match = tail.match(/(\d{3}\s?[0-9]{2})\s+(.+)/);
      if (match && match[1] && match[2]) {
        zip = match[1];
        city = String(match[2]).trim();
      } else if (!city) {
        city = tail;
      }
    }
  }

  // If zip/city not found in address, try postal line
  if ((!zip || !city) && postalLine) {
    const match = postalLine.match(/(\d{3}\s?[0-9]{2})\s+(.+)/);
    if (match && match[1] && match[2]) {
      zip = match[1];
      city = String(match[2]).trim();
    }
  }

  return { street, zip, city };
}

/**
 * Guess company name from first lines of document
 */
function guessCompanyName(text: string): string {
  const firstLines = text
    .split('\n')
    .slice(0, 12)
    .map(s => s.trim())
    .filter(Boolean);

  // Find where offer/invoice/order header starts
  const stopIdx = firstLines.findIndex(l => /offert|order|faktura|invoice/i.test(l));
  const scope = stopIdx > 0 ? firstLines.slice(0, stopIdx) : firstLines;

  // Find a line that looks like a company name
  const candidate = scope.find(
    l =>
      /[A-Za-zÅÄÖåäö]/.test(l) &&
      l.split(' ').length >= 2 &&
      l.length <= 60 &&
      !/^\d+$/.test(l) // Not just numbers
  );

  if (candidate) {
    // Remove common company prefixes if they appear at start
    return candidate.replace(/^(AB|HB|KB)\s+/i, '').trim();
  }

  return '';
}

/**
 * Extract line items from table-like structures in text
 * This is a simple implementation - can be enhanced for specific formats
 */
function extractLineItems(text: string): Array<{
  name: string;
  hours?: string;
  pricePerHour?: string;
  total?: string;
}> {
  const items: Array<{
    name: string;
    hours?: string;
    pricePerHour?: string;
    total?: string;
  }> = [];

  // Look for table patterns (very basic - enhance as needed)
  const lines = text.split('\n');
  let inTable = false;

  for (const line of lines) {
    // Detect table start
    if (/(?:Beskrivning|Description|Tjänst|Service|Post)/i.test(line)) {
      inTable = true;
      continue;
    }

    // Detect table end
    if (inTable && /(?:Summa|Total|Moms|VAT)/i.test(line)) {
      inTable = false;
      break;
    }

    // Extract items (simple pattern: text followed by numbers)
    if (inTable) {
      const match = line.match(/^(.+?)\s+([0-9,\.]+)\s+([0-9,\. ]+)\s+([0-9,\. ]+)/);
      if (match) {
        items.push({
          name: match[1].trim(),
          hours: match[2],
          pricePerHour: match[3],
          total: match[4],
        });
      }
    }
  }

  return items;
}
