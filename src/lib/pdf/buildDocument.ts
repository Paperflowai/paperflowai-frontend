import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

export interface DocumentData {
  customerId: string;
  title?: string;
  amount?: number;
  currency?: string;
  needsPrint?: boolean;
  data?: any;
}

export type DocumentVariant = 'offer' | 'orderConfirmation';

// Gemensam PDF-mall för både OFFERT och ORDERBEKRÄFTELSE
export async function buildDocument(data: DocumentData, variant: DocumentVariant): Promise<Uint8Array> {
  // Validera indata
  if (!data) {
    throw new Error('Data is required for PDF generation');
  }
  
  if (!data.customerId) {
    throw new Error('customerId is required');
  }
  
  if (!variant || !['offer', 'orderConfirmation'].includes(variant)) {
    throw new Error('variant must be "offer" or "orderConfirmation"');
  }

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]); // A4
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const marginX = 50;
  let y = 800;

  const draw = (text: string, bold = false, size = 12, color = rgb(0, 0, 0)) => {
    const usedFont = bold ? fontBold : font;
    const safeText = String(text || '').trim();
    if (safeText) {
      page.drawText(safeText, { x: marginX, y, size, font: usedFont, color });
    }
    y -= size + 8;
  };

  // Header - endast skillnaden mellan OFFERT och ORDERBEKRÄFTELSE
  const title = variant === 'orderConfirmation' ? 'ORDERBEKRÄFTELSE' : 'OFFERT';
  draw(title, true, 20);
  draw(new Date().toLocaleString(), false, 10, rgb(0.4, 0.4, 0.4));
  y -= 6;

  // Grunddata - identisk för båda dokumenten
  draw(`Kundkort / Customer ID: ${data.customerId || 'N/A'}`, false, 12);
  draw(`Titel: ${data.title ?? (variant === 'orderConfirmation' ? 'Orderbekräftelse' : 'Offert')}`, false, 12);
  draw(`Belopp: ${String(data.amount ?? 0)} ${data.currency ?? "SEK"}`, false, 12);
  draw(`Markerad för papperskopia: ${Boolean(data.needsPrint ?? false) ? "Ja" : "Nej"}`, false, 12);

  // Kundinformation - förbättrad för ORDERBEKRÄFTELSE med null-säker hantering
  if (data.data && typeof data.data === 'object') {
    y -= 10;
    if (variant === 'orderConfirmation') {
      draw("Kundinformation:", true, 12);
      
      const customerName = data.data.customerName || data.data.companyName || '';
      if (customerName) draw(`Företag: ${customerName}`, false, 12);
      
      const customerAddress = data.data.customerAddress || data.data.address || '';
      if (customerAddress) draw(`Adress: ${customerAddress}`, false, 12);
      
      const customerPhone = data.data.customerPhone || data.data.phone || '';
      if (customerPhone) draw(`Telefon: ${customerPhone}`, false, 12);
      
      const customerEmail = data.data.customerEmail || data.data.email || '';
      if (customerEmail) draw(`E-post: ${customerEmail}`, false, 12);
      
      y -= 10;
      draw("Orderinformation:", true, 12);
      
      const orderNumber = data.data.orderNumber || '';
      if (orderNumber) draw(`Ordernummer: ${orderNumber}`, false, 12);
      
      const orderDate = data.data.orderDate || '';
      if (orderDate) draw(`Datum: ${orderDate}`, false, 12);
    }
  }

  y -= 10;
  draw("Sammanfattning av data:", true, 12);

  // Lista nycklar från data - identisk för båda dokumenten med robust hantering
  try {
    const clone = JSON.parse(JSON.stringify(data.data ?? {}));
    const keys = Object.keys(clone).slice(0, 12);
    
    // Filtrera bort falsy värden innan map
    const validEntries = keys
      .map(k => ({ key: k, value: clone[k] }))
      .filter(({ key, value }) => key && value !== null && value !== undefined && value !== '');
    
    for (const { key, value } of validEntries) {
      if (y < 60) break;
      
      // Robust hantering av värden
      let displayValue = '';
      if (typeof value === "object") {
        try {
          displayValue = JSON.stringify(value);
        } catch {
          displayValue = '[Object]';
        }
      } else {
        displayValue = String(value);
      }
      
      const line = `${key}: ${displayValue}`.slice(0, 110);
      if (line.trim()) {
        draw(line, false, 10);
      }
    }
  } catch (error) {
    draw("Kunde inte serialisera data.", false, 10);
    console.warn('[buildDocument] Data serialization error:', error);
  }

  return pdfDoc.save();
}
