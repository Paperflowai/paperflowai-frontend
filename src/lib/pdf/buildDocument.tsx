// src/lib/pdf/buildDocument.tsx
import { pdf } from '@react-pdf/renderer';
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

  // Vi skickar samma props till OfferPdf; variant styr bara rubriken inne i komponenten.
  const instance = pdf(
    <OfferPdf
      variant={variant}
      data={{
        kundnamn: data?.data?.customerName ?? 'Kund',
        pris: (data.amount ?? 0).toString(),
        beskrivning: data?.data?.description ?? '',
        offertId: data?.data?.offerNumber ?? '',
        kundId: data.customerId,
        datum: data?.data?.orderDate ?? new Date().toISOString().slice(0, 10),
        validTill: data?.data?.validity ?? undefined,
        kontaktperson: data?.data?.contactPerson ?? undefined,
        telefon: data?.data?.customerPhone ?? undefined,
        email: data?.data?.customerEmail ?? undefined,
      }}
    />
  );

  const buffer = await instance.toBuffer();
  console.log('[buildDocument] Buffer length:', buffer.length);

  // Skicka tillbaka Node Buffer direkt (Supabase gillar Buffer)
  return buffer as unknown as Uint8Array;
}

// Default export för bakåtkompatibilitet
export default buildDocument;
