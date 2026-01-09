import * as React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

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
});

interface ProfessionalOfferPdfProps {
  textData: string;
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
  textData,
  companyInfo = {
    name: 'PaperflowAI',
    email: 'info@paperflowai.se',
    website: 'www.paperflowai.se'
  }
}) => {
  const parsed = parseOfferText(textData);
  const today = new Date().toLocaleDateString('sv-SE');

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
          {/* Kundinfo */}
          <View style={styles.infoBox}>
            <Text style={styles.infoTitle}>KUND</Text>
            {parsed.customer.name && <Text style={styles.infoText}>{parsed.customer.name}</Text>}
            {parsed.customer.contact && <Text style={styles.infoText}>{parsed.customer.contact}</Text>}
            {parsed.customer.orgNr && <Text style={styles.infoText}>Org.nr: {parsed.customer.orgNr}</Text>}
            {parsed.customer.address && <Text style={styles.infoText}>{parsed.customer.address}</Text>}
            {parsed.customer.phone && <Text style={styles.infoText}>Tel: {parsed.customer.phone}</Text>}
            {parsed.customer.email && <Text style={styles.infoText}>E-post: {parsed.customer.email}</Text>}
          </View>

          {/* Offertinfo */}
          <View style={styles.infoBoxRight}>
            <Text style={styles.infoTitle}>OFFERTINFORMATION</Text>
            <Text style={styles.infoText}>Datum: {parsed.date || today}</Text>
            {parsed.offerNumber && <Text style={styles.infoText}>Offertnummer: {parsed.offerNumber}</Text>}
            <Text style={styles.infoText}>Giltig till: {new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('sv-SE')}</Text>
          </View>
        </View>

        {/* CONTENT */}
        <View style={styles.contentSection}>
          <Text style={styles.sectionTitle}>BESKRIVNING</Text>
          <Text style={styles.bodyText}>{textData}</Text>
        </View>

        {/* SUMMARY BOX */}
        {(parsed.summary.subtotal || parsed.summary.total) && (
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

        {/* TERMS */}
        {parsed.terms.length > 0 && (
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
