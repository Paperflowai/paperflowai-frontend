import * as React from 'react';
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';

// PDF-säkra styles (inga gradients, flex-gap, grid)
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: 'Helvetica',
    color: '#333',
    backgroundColor: '#FFFFFF',
  },
  // HEADER
  header: {
    marginBottom: 30,
    borderBottom: '2 solid #000',
    paddingBottom: 15,
  },
  companyName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 3,
  },
  headerSubtext: {
    fontSize: 9,
    color: '#666',
  },
  // TITLE
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
    marginTop: 10,
    color: '#000',
  },
  // INFO SECTION
  infoRow: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  infoBox: {
    width: '48%',
    padding: 12,
    backgroundColor: '#F8F8F8',
  },
  infoBoxRight: {
    width: '48%',
    padding: 12,
    backgroundColor: '#F8F8F8',
    marginLeft: '4%',
  },
  infoTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#000',
  },
  infoText: {
    fontSize: 9,
    marginBottom: 3,
    color: '#444',
  },
  // CONTENT
  contentSection: {
    marginTop: 20,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 10,
    marginTop: 15,
    color: '#000',
  },
  bodyText: {
    fontSize: 10,
    lineHeight: 1.5,
    marginBottom: 8,
    color: '#444',
    whiteSpace: 'pre-wrap',
  },
  // TABLE
  table: {
    marginTop: 15,
    marginBottom: 15,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#000',
    padding: 8,
    fontWeight: 'bold',
    color: '#FFF',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottom: '1 solid #E0E0E0',
    padding: 8,
  },
  tableRowAlt: {
    flexDirection: 'row',
    backgroundColor: '#F8F8F8',
    borderBottom: '1 solid #E0E0E0',
    padding: 8,
  },
  tableCell: {
    fontSize: 9,
  },
  tableCellDesc: {
    width: '50%',
    fontSize: 9,
  },
  tableCellQty: {
    width: '15%',
    fontSize: 9,
    textAlign: 'right',
  },
  tableCellPrice: {
    width: '17%',
    fontSize: 9,
    textAlign: 'right',
  },
  tableCellTotal: {
    width: '18%',
    fontSize: 9,
    textAlign: 'right',
  },
  // SUMMARY
  summaryBox: {
    marginTop: 15,
    marginLeft: 'auto',
    width: '40%',
    borderTop: '2 solid #000',
    paddingTop: 10,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  summaryLabel: {
    fontSize: 10,
    color: '#444',
  },
  summaryValue: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#000',
  },
  summaryTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 8,
    borderTop: '1 solid #000',
  },
  summaryTotalLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#000',
  },
  summaryTotalValue: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#000',
  },
  // TERMS
  termsSection: {
    marginTop: 25,
    padding: 12,
    backgroundColor: '#F8F8F8',
  },
  termsTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#000',
  },
  termsText: {
    fontSize: 9,
    lineHeight: 1.4,
    marginBottom: 3,
    color: '#444',
  },
  // FOOTER
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    borderTop: '1 solid #E0E0E0',
    paddingTop: 10,
    textAlign: 'center',
  },
  footerText: {
    fontSize: 8,
    color: '#888',
    marginBottom: 2,
  },
  // IMAGES
  imageSection: {
    marginTop: 20,
    marginBottom: 20,
  },
  imageTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#000',
  },
  image: {
    maxWidth: '100%',
    maxHeight: 400,
    marginBottom: 10,
    objectFit: 'contain',
  },
});

interface CustomerData {
  companyName: string;
  orgNr?: string | null;
  contactPerson?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  zip?: string | null;
  city?: string | null;
  customerNumber?: string | null;
  contactDate?: string | null;
  role?: string | null;
}

interface OfferRow {
  id: string;
  description: string;
  qty: number;
  price: number;
  source: 'offer' | 'extra';
  approved: boolean;
  approved_at: string | null;
}

interface ProfessionalOfferPdfProps {
  customer?: CustomerData;  // ✅ Strukturerad data (prioriteras)
  rows?: OfferRow[];        // ✅ Rader från data.rows
  textData: string;         // ✅ Används bara för beskrivning/fallback
  images?: string[];        // ✅ Bilder (base64 eller URLs)
  companyInfo?: {
    name: string;
    address?: string;
    phone?: string;
    email?: string;
    website?: string;
  };
}

// Funktion för att parsa textData
function parseOfferText(text: string) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  const data: any = {
    title: '',
    date: '',
    offerNumber: '',
    customer: {},
    items: [],
    summary: {},
    terms: [],
  };

  let currentSection = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Hitta datum
    if (/^Datum:/i.test(line)) {
      data.date = line.split(':')[1]?.trim() || '';
    }

    // Hitta offertnummer
    if (/^Offertnummer:/i.test(line) || /^Offert-?nr:/i.test(line)) {
      data.offerNumber = line.split(':')[1]?.trim() || '';
    }

    // Kundinfo-sektion
    if (/^(Kunduppgifter|Kundinformation|Till:|Företag:)/i.test(line)) {
      currentSection = 'customer';
      if (/^Företag:/i.test(line)) {
        data.customer.name = line.split(':')[1]?.trim() || '';
      }
      continue;
    }

    // Parse kundinfo
    if (currentSection === 'customer') {
      if (/^Kontaktperson:/i.test(line)) {
        data.customer.contact = line.split(':')[1]?.trim();
      } else if (/^E-post:/i.test(line) || /^Email:/i.test(line)) {
        data.customer.email = line.split(':')[1]?.trim();
      } else if (/^Telefon:/i.test(line) || /^Tel:/i.test(line)) {
        data.customer.phone = line.split(':')[1]?.trim();
      } else if (/^Org\.?nr:/i.test(line)) {
        data.customer.orgNr = line.split(':')[1]?.trim();
      } else if (/^Adress:/i.test(line)) {
        data.customer.address = line.split(':')[1]?.trim();
      } else if (!data.customer.name && i === 1) {
        // Om första raden efter titel, anta företagsnamn
        data.customer.name = line;
      }
    }

    // Tjänster/items-sektion
    if (/^(Tjänster|Beskrivning|Projektbeskrivning|Innehåll)/i.test(line)) {
      currentSection = 'items';
      continue;
    }

    // Summering
    if (/^Summa|^Totalt|^Total/i.test(line)) {
      currentSection = 'summary';
      const match = line.match(/([\d\s,.]+)\s*(kr|SEK)/i);
      if (match) {
        const amount = match[1].replace(/\s/g, '').replace(',', '.');
        if (/exkl.*moms/i.test(line)) {
          data.summary.subtotal = amount;
        } else if (/inkl.*moms/i.test(line)) {
          data.summary.total = amount;
        }
      }
    }

    if (/^Moms/i.test(line)) {
      const match = line.match(/([\d\s,.]+)\s*(kr|SEK)/i);
      if (match) {
        data.summary.vat = match[1].replace(/\s/g, '').replace(',', '.');
      }
    }

    // Villkor
    if (/^(Leveransvillkor|Betalningsvillkor|Villkor|Giltighet)/i.test(line)) {
      currentSection = 'terms';
      continue;
    }

    if (currentSection === 'terms') {
      data.terms.push(line);
    }

    // Parse title (första raden ofta titel)
    if (i === 0 && /^(OFFERT|Offert|#)/i.test(line)) {
      data.title = line.replace(/^#\s*/, '').trim();
    }
  }

  return data;
}

const ProfessionalOfferPdf: React.FC<ProfessionalOfferPdfProps> = ({
  customer,
  rows = [],
  textData,
  images = [],
  companyInfo = {
    name: 'PaperflowAI',
    email: 'info@paperflowai.se',
    website: 'www.paperflowai.se'
  }
}) => {
  // ✅ PRIORITERA strukturerad customer-data, fallback till textData-parsing
  const parsed = customer ? null : parseOfferText(textData);
  const today = new Date().toLocaleDateString('sv-SE');

  // Använd customer-data om tillgänglig, annars parsed från text
  const customerData = customer ? {
    name: customer.companyName,
    contact: customer.contactPerson,
    role: customer.role,
    orgNr: customer.orgNr,
    address: customer.address,
    zip: customer.zip,
    city: customer.city,
    phone: customer.phone,
    email: customer.email,
  } : parsed?.customer || {};

  const offerDate = customer?.contactDate || parsed?.date || today;
  const offerNumber = customer?.customerNumber || parsed?.offerNumber;

  // Beräkna summor från rows
  const totalSum = rows.reduce((sum, row) => sum + (row.qty * row.price), 0);
  const vatPercent = 25;
  const vatAmount = totalSum * (vatPercent / 100);
  const totalWithVat = totalSum + vatAmount;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* HEADER */}
        <View style={styles.header}>
          <Text style={styles.companyName}>{companyInfo.name}</Text>
          {companyInfo.address && <Text style={styles.headerSubtext}>{companyInfo.address}</Text>}
          <Text style={styles.headerSubtext}>
            {[companyInfo.phone, companyInfo.email, companyInfo.website]
              .filter(Boolean)
              .join(' • ')}
          </Text>
        </View>

        {/* TITLE */}
        <Text style={styles.title}>OFFERT</Text>

        {/* INFO BOXES */}
        <View style={styles.infoRow}>
          {/* Kundinfo - ✅ Använder customerData från strukturerad source */}
          <View style={styles.infoBox}>
            <Text style={styles.infoTitle}>KUND</Text>
            {customerData.name && <Text style={styles.infoText}>{customerData.name}</Text>}
            {customerData.contact && <Text style={styles.infoText}>{customerData.contact}</Text>}
            {customerData.role && <Text style={styles.infoText}>{customerData.role}</Text>}
            {customerData.orgNr && <Text style={styles.infoText}>Org.nr: {customerData.orgNr}</Text>}
            {customerData.address && <Text style={styles.infoText}>{customerData.address}</Text>}
            {customerData.zip && customerData.city && (
              <Text style={styles.infoText}>{customerData.zip} {customerData.city}</Text>
            )}
            {customerData.phone && <Text style={styles.infoText}>Tel: {customerData.phone}</Text>}
            {customerData.email && <Text style={styles.infoText}>E-post: {customerData.email}</Text>}
          </View>

          {/* Offertinfo - ✅ Använder strukturerad data */}
          <View style={styles.infoBoxRight}>
            <Text style={styles.infoTitle}>OFFERTINFORMATION</Text>
            <Text style={styles.infoText}>Datum: {offerDate}</Text>
            {offerNumber && <Text style={styles.infoText}>Offertnummer: {offerNumber}</Text>}
            <Text style={styles.infoText}>Giltig till: {new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('sv-SE')}</Text>
          </View>
        </View>

        {/* CONTENT */}
        <View style={styles.contentSection}>
          <Text style={styles.sectionTitle}>BESKRIVNING</Text>
          <Text style={styles.bodyText}>{textData}</Text>
        </View>

        {/* ROWS TABLE */}
        {rows.length > 0 && (
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={styles.tableCellDesc}>Beskrivning</Text>
              <Text style={styles.tableCellQty}>Antal</Text>
              <Text style={styles.tableCellPrice}>Pris</Text>
              <Text style={styles.tableCellTotal}>Summa</Text>
            </View>
            {rows.map((row, index) => {
              const rowTotal = row.qty * row.price;
              const rowStyle = index % 2 === 0 ? styles.tableRow : styles.tableRowAlt;
              return (
                <View key={row.id} style={rowStyle}>
                  <Text style={styles.tableCellDesc}>{row.description}</Text>
                  <Text style={styles.tableCellQty}>{row.qty}</Text>
                  <Text style={styles.tableCellPrice}>{row.price.toFixed(2)} kr</Text>
                  <Text style={styles.tableCellTotal}>{rowTotal.toFixed(2)} kr</Text>
                </View>
              );
            })}
          </View>
        )}

        {/* SUMMARY BOX - från rows om tillgänglig */}
        {rows.length > 0 ? (
          <View style={styles.summaryBox}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Summa exkl. moms:</Text>
              <Text style={styles.summaryValue}>{totalSum.toFixed(2)} SEK</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Moms ({vatPercent}%):</Text>
              <Text style={styles.summaryValue}>{vatAmount.toFixed(2)} SEK</Text>
            </View>
            <View style={styles.summaryTotal}>
              <Text style={styles.summaryTotalLabel}>Totalt inkl. moms:</Text>
              <Text style={styles.summaryTotalValue}>{totalWithVat.toFixed(2)} SEK</Text>
            </View>
          </View>
        ) : (parsed?.summary?.subtotal || parsed?.summary?.total) && (
          <View style={styles.summaryBox}>
            {parsed.summary.subtotal && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Summa exkl. moms:</Text>
                <Text style={styles.summaryValue}>{parsed.summary.subtotal} SEK</Text>
              </View>
            )}
            {parsed.summary.vat && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Moms (25%):</Text>
                <Text style={styles.summaryValue}>{parsed.summary.vat} SEK</Text>
              </View>
            )}
            {parsed.summary.total && (
              <View style={styles.summaryTotal}>
                <Text style={styles.summaryTotalLabel}>Totalt inkl. moms:</Text>
                <Text style={styles.summaryTotalValue}>{parsed.summary.total} SEK</Text>
              </View>
            )}
          </View>
        )}

        {/* IMAGES */}
        {images.length > 0 && (
          <View style={styles.imageSection}>
            <Text style={styles.imageTitle}>BILAGOR</Text>
            {images.map((img: string, idx: number) => (
              <Image key={idx} src={img} style={styles.image} />
            ))}
          </View>
        )}

        {/* TERMS - från textData om tillgänglig */}
        {parsed?.terms && parsed.terms.length > 0 && (
          <View style={styles.termsSection}>
            <Text style={styles.termsTitle}>VILLKOR</Text>
            {parsed.terms.map((term: string, idx: number) => (
              <Text key={idx} style={styles.termsText}>• {term}</Text>
            ))}
          </View>
        )}

        {/* FOOTER */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Tack för ditt förtroende!</Text>
          <Text style={styles.footerText}>Denna offert är giltig i 30 dagar från ovanstående datum.</Text>
        </View>
      </Page>
    </Document>
  );
};

export default ProfessionalOfferPdf;
