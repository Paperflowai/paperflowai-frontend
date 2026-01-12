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

interface CustomerData {
  companyName: string;
  orgNr?: string | null;
  contactPerson?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  zip?: string | null;
  city?: string | null;
}

interface OrderConfirmationPdfProps {
  customer: CustomerData;
  details?: {
    totalSum?: string;
    vatPercent?: string;
    vatAmount?: string;
  };
  number?: string;
  companyInfo?: {
    name: string;
    address?: string;
    phone?: string;
    email?: string;
    website?: string;
  };
}

const OrderConfirmationPdf: React.FC<OrderConfirmationPdfProps> = ({
  customer,
  details,
  number,
  companyInfo = {
    name: 'PaperflowAI',
    email: 'info@paperflowai.se',
    website: 'www.paperflowai.se'
  }
}) => {
  const today = new Date().toLocaleDateString('sv-SE');
  const totalSum = details?.totalSum ? parseFloat(details.totalSum) : 0;
  const vatPercent = details?.vatPercent ? parseFloat(details.vatPercent) : 0;
  const vatAmount = details?.vatAmount ? parseFloat(details.vatAmount) : (totalSum * vatPercent / 100);
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
        <Text style={styles.title}>ORDERBEKRÄFTELSE</Text>

        {/* INFO BOXES */}
        <View style={styles.infoRow}>
          {/* Kundinfo */}
          <View style={styles.infoBox}>
            <Text style={styles.infoTitle}>KUND</Text>
            {customer.companyName && <Text style={styles.infoText}>{customer.companyName}</Text>}
            {customer.contactPerson && <Text style={styles.infoText}>{customer.contactPerson}</Text>}
            {customer.orgNr && <Text style={styles.infoText}>Org.nr: {customer.orgNr}</Text>}
            {customer.address && <Text style={styles.infoText}>{customer.address}</Text>}
            {customer.zip && customer.city && (
              <Text style={styles.infoText}>{customer.zip} {customer.city}</Text>
            )}
            {customer.phone && <Text style={styles.infoText}>Tel: {customer.phone}</Text>}
            {customer.email && <Text style={styles.infoText}>E-post: {customer.email}</Text>}
          </View>

          {/* Orderinformation */}
          <View style={styles.infoBoxRight}>
            <Text style={styles.infoTitle}>ORDERINFORMATION</Text>
            <Text style={styles.infoText}>Datum: {today}</Text>
            {number && <Text style={styles.infoText}>Ordernummer: {number}</Text>}
          </View>
        </View>

        {/* SUMMARY BOX */}
        {(totalSum > 0 || vatAmount > 0) && (
          <View style={styles.summaryBox}>
            {totalSum > 0 && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Summa exkl. moms:</Text>
                <Text style={styles.summaryValue}>{totalSum.toFixed(2)} SEK</Text>
              </View>
            )}
            {vatAmount > 0 && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Moms ({vatPercent}%):</Text>
                <Text style={styles.summaryValue}>{vatAmount.toFixed(2)} SEK</Text>
              </View>
            )}
            {(totalSum > 0 || vatAmount > 0) && (
              <View style={styles.summaryTotal}>
                <Text style={styles.summaryTotalLabel}>Totalt inkl. moms:</Text>
                <Text style={styles.summaryTotalValue}>{totalWithVat.toFixed(2)} SEK</Text>
              </View>
            )}
          </View>
        )}

        {/* FOOTER */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Tack för din beställning!</Text>
        </View>
      </Page>
    </Document>
  );
};

export default OrderConfirmationPdf;

