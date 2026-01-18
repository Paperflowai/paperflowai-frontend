// src/lib/pdf/buildDocument.tsx
import { pdf, Document, Page, Text, StyleSheet, View } from '@react-pdf/renderer';
import OfferPdf from '@/lib/pdf/OfferPdf';
import ProfessionalOfferPdf from '@/lib/pdf/ProfessionalOfferPdf';

export type DocumentType = 'offer' | 'order' | 'invoice' | 'orderConfirmation';

// Ny signatur som används av API routes
export interface BuildDocumentParams {
  type: DocumentType;
  data: any;
}

// Gammal signatur för bakåtkompatibilitet
export interface LegacyDocumentData {
  customerId: string;
  title?: string;
  amount?: number;
  currency?: string;
  needsPrint?: boolean;
  data?: any;
}

export type DocumentVariant = 'offer' | 'orderConfirmation';

const styles = StyleSheet.create({
  page: {
    padding: 40,
  },
  title: {
    fontSize: 18,
    marginBottom: 16,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 12,
    color: '#666',
  },
  body: {
    fontSize: 12,
    lineHeight: 1.4,
  },
  section: {
    marginBottom: 10,
  },
  label: {
    fontSize: 10,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  value: {
    fontSize: 12,
    marginBottom: 8,
  },
});

// Hjälpfunktion för att rendera en enkel dokumentsida
function renderSimpleDocument(
  title: string,
  subtitle: string,
  data: any
): JSX.Element {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>

        {/* Kundinformation */}
        {data.customer && (
          <View style={styles.section}>
            <Text style={styles.label}>Kund:</Text>
            <Text style={styles.value}>
              {data.customer.companyName || 'Okänd kund'}
              {data.customer.orgNr && `\nOrg.nr: ${data.customer.orgNr}`}
              {data.customer.contactPerson && `\nKontaktperson: ${data.customer.contactPerson}`}
              {data.customer.email && `\nE-post: ${data.customer.email}`}
              {data.customer.phone && `\nTelefon: ${data.customer.phone}`}
            </Text>
          </View>
        )}

        {/* Detaljer */}
        {data.details && (
          <View style={styles.section}>
            <Text style={styles.label}>Detaljer:</Text>
            {data.details.offerText && (
              <Text style={styles.body}>{data.details.offerText}</Text>
            )}
            {data.details.totalSum && (
              <Text style={styles.value}>
                Summa: {data.details.totalSum} kr
                {data.details.vatPercent && ` (Moms: ${data.details.vatPercent}%)`}
              </Text>
            )}
          </View>
        )}

        {/* Förfallodatum för fakturor */}
        {data.dueDate && (
          <View style={styles.section}>
            <Text style={styles.label}>Förfallodatum:</Text>
            <Text style={styles.value}>{data.dueDate}</Text>
          </View>
        )}
      </Page>
    </Document>
  );
}

// Huvudfunktion med överlagrade signaturer
export async function buildDocument(
  dataOrParams: LegacyDocumentData | BuildDocumentParams,
  legacyVariant?: DocumentVariant
): Promise<Uint8Array> {
  let docElement: JSX.Element;
  let type: DocumentType;
  let data: any;

  // Detektera om vi använder nya eller gamla signaturen
  if ('type' in dataOrParams && typeof dataOrParams.type === 'string') {
    // Ny signatur: { type, data }
    type = dataOrParams.type as DocumentType;
    data = dataOrParams.data;
    console.log('[buildDocument] Using new signature with type:', type);
  } else if (legacyVariant) {
    // Gammal signatur: (data, variant)
    type = legacyVariant as DocumentType;
    data = dataOrParams as LegacyDocumentData;
    console.log('[buildDocument] Using legacy signature with variant:', legacyVariant);
  } else {
    throw new Error('Invalid buildDocument parameters');
  }

  console.log('[buildDocument] Building PDF with type:', type);
  console.log('[buildDocument] Data keys:', data ? Object.keys(data) : 'no data');

  // Hantera olika dokumenttyper
  switch (type) {
    case 'order':
      docElement = (
        <ProfessionalOfferPdf
          customer={data.customer}
          textData={`# ORDERBEKRÄFTELSE\n\nOrdernummer: ${data.number}\n\n${data.details?.offerText || ''}`}
          companyInfo={{
            name: 'PaperflowAI',
            email: 'info@paperflowai.se',
            website: 'www.paperflowai.se'
          }}
        />
      );
      break;

    case 'invoice':
      docElement = renderSimpleDocument(
        'FAKTURA',
        data.number || 'Faktura',
        data
      );
      break;

    case 'offer':
    case 'orderConfirmation':
      // Använd befintlig OfferPdf för offer och orderConfirmation
      const textData: string | undefined = data?.textData || data?.data?.textData;
      const customer = data?.customer;

      if (customer && customer.companyName) {
        // ✅ GPT-flödet – använd strukturerad customerData (mobil-säker!)
        docElement = (
          <ProfessionalOfferPdf
            customer={{
              companyName: customer.companyName,
              orgNr: customer.orgNr,
              contactPerson: customer.contactPerson,
              email: customer.email,
              phone: customer.phone,
              address: customer.address,
              zip: customer.zip,
              city: customer.city,
              customerNumber: customer.customerNumber,
              contactDate: customer.contactDate,
              role: customer.role,
            }}
            textData={textData || ''}
            companyInfo={{
              name: 'PaperflowAI',
              email: 'info@paperflowai.se',
              website: 'www.paperflowai.se'
            }}
          />
        );
      } else if (textData && textData.trim().length > 0) {
        // ⚠️ Fallback: Om ingen customer-data finns, parsa textData (legacy)
        console.warn('[buildDocument] Ingen customer-data, använder textData-parsing (instabilt!)');
        docElement = (
          <ProfessionalOfferPdf
            textData={textData}
            companyInfo={{
              name: 'PaperflowAI',
              email: 'info@paperflowai.se',
              website: 'www.paperflowai.se'
            }}
          />
        );
      } else {
        // Bakåtkompatibelt – använd OfferPdf-mallen
        docElement = (
          <OfferPdf
            variant={type === 'orderConfirmation' ? 'orderConfirmation' : 'offer'}
            data={{
              kundnamn: data?.customer?.companyName || data?.data?.customerName || 'Kund',
              pris: data?.details?.totalSum || (data.amount ?? 0).toString(),
              beskrivning: data?.details?.offerText || data?.data?.description || '',
              offertId: data?.number || data?.data?.offerNumber || '',
              kundId: data?.customer_id || data?.customerId || '',
              datum: data?.created_at?.slice(0, 10) || data?.data?.orderDate || new Date().toISOString().slice(0, 10),
              validTill: data?.data?.validity ?? undefined,
              kontaktperson: data?.customer?.contactPerson || data?.data?.contactPerson || undefined,
              telefon: data?.customer?.phone || data?.data?.customerPhone || undefined,
              email: data?.customer?.email || data?.data?.customerEmail || undefined,
            }}
          />
        );
      }
      break;

    default:
      throw new Error(`Unknown document type: ${type}`);
  }

  // Skapa pdf-instans från dokumentet
  const instance = pdf(docElement);

  // Rendera till PDF-sträng
  const pdfString = await instance.toString();
  console.log('[buildDocument] pdfString length:', pdfString.length);

  // Gör om strängen till riktiga bytes
  const encoder = new TextEncoder();
  const uint8 = encoder.encode(pdfString);

  console.log('[buildDocument] Uint8Array length:', uint8.length);

  return uint8;
}

// Default export för bakåtkompatibilitet
export default buildDocument;
