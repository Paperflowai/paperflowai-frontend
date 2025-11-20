// src/lib/pdf/buildDocument.tsx
import { pdf, Document, Page, Text, StyleSheet } from '@react-pdf/renderer';
import OfferPdf from '@/lib/pdf/OfferPdf';

export type DocumentVariant = 'offer' | 'orderConfirmation';

export interface DocumentData {
  customerId: string;
  title?: string;
  amount?: number;
  currency?: string;
  needsPrint?: boolean;
  data?: any;
}

const styles = StyleSheet.create({
  page: {
    padding: 40,
  },
  title: {
    fontSize: 18,
    marginBottom: 16,
  },
  body: {
    fontSize: 12,
    lineHeight: 1.4,
  },
});

// Gemensam builder som renderar React-PDF-komponenten till riktiga bytes
export async function buildDocument(
  data: DocumentData,
  variant: DocumentVariant
): Promise<Uint8Array> {
  if (!data?.customerId) throw new Error('customerId is required');
  if (variant !== 'offer' && variant !== 'orderConfirmation') {
    throw new Error('variant must be "offer" or "orderConfirmation"');
  }

  console.log('[buildDocument] Building PDF with variant:', variant);
  console.log('[buildDocument] Data keys:', Object.keys(data));

  const textData: string | undefined = data?.data?.textData;

  let docElement;

  // 🔹 FALL 1: GPT-flödet – vi har färdig offert-text
  if (textData && textData.trim().length > 0) {
    docElement = (
      <Document>
        <Page size="A4" style={styles.page}>
          <Text style={styles.title}>{data.title ?? 'Offert'}</Text>
          <Text style={styles.body}>{textData}</Text>
        </Page>
      </Document>
    );
  } else {
    // 🔹 FALL 2: Bakåtkompatibelt – använd OfferPdf-mallen
    docElement = (
      <OfferPdf
        variant={variant}
        data={{
          kundnamn: data?.data?.customerName ?? 'Kund',
          pris: (data.amount ?? 0).toString(),
          beskrivning: data?.data?.description ?? '',
          offertId: data?.data?.offerNumber ?? '',
          kundId: data.customerId,
          datum:
            data?.data?.orderDate ??
            new Date().toISOString().slice(0, 10),
          validTill: data?.data?.validity ?? undefined,
          kontaktperson: data?.data?.contactPerson ?? undefined,
          telefon: data?.data?.customerPhone ?? undefined,
          email: data?.data?.customerEmail ?? undefined,
        }}
      />
    );
  }

  // Skapa pdf-instans från dokumentet
  const instance = pdf(docElement);

  // ✅ Rendera till PDF-sträng
  const pdfString = await instance.toString();
  console.log('[buildDocument] pdfString length:', pdfString.length);

  // ✅ Gör om strängen till riktiga bytes
  const encoder = new TextEncoder();
  const uint8 = encoder.encode(pdfString);

  console.log('[buildDocument] Uint8Array length:', uint8.length);

  return uint8;
}

// Default export för bakåtkompatibilitet
export default buildDocument;
