import * as React from 'react';
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';

// Define the OfferData type
export interface OfferData {
  kundnamn: string;
  pris: string;
  beskrivning: string;
  offertId: string;
  kundId: string;
  datum?: string;
  validTill?: string;
  kontaktperson?: string;
  telefon?: string;
  email?: string;
}

// Create styles
const styles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    backgroundColor: '#FFFFFF',
    padding: 30,
    fontFamily: 'Helvetica',
  },
  header: {
    fontSize: 24,
    marginBottom: 20,
    textAlign: 'center',
    color: '#333333',
    fontWeight: 'bold',
  },
  section: {
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 14,
    marginBottom: 8,
    fontWeight: 'bold',
    color: '#333333',
  },
  text: {
    fontSize: 12,
    marginBottom: 5,
    color: '#666666',
  },
  customerInfo: {
    backgroundColor: '#F5F5F5',
    padding: 15,
    borderRadius: 5,
    marginBottom: 20,
  },
  offerDetails: {
    backgroundColor: '#FFFFFF',
    border: '1px solid #DDDDDD',
    padding: 15,
    borderRadius: 5,
    marginBottom: 20,
  },
  priceSection: {
    backgroundColor: '#E8F4FD',
    padding: 15,
    borderRadius: 5,
    textAlign: 'center',
  },
  price: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0066CC',
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 30,
    right: 30,
    textAlign: 'center',
    fontSize: 10,
    color: '#999999',
  },
});

// Define the OfferPdf component
interface OfferPdfProps {
  data: OfferData;
  variant?: 'offer' | 'orderConfirmation';
  logoUrl?: string;
  rotImageUrl?: string;
}

const OfferPdf: React.FC<OfferPdfProps> = ({ data, variant = 'offer', logoUrl, rotImageUrl }) => {
  const currentDate = new Date().toLocaleDateString('sv-SE');
  const validTill = data.validTill || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('sv-SE');
  const title = variant === 'orderConfirmation' ? 'ORDERBEKRÄFTELSE' : 'OFFERT';
  const logoAlt = data.kundnamn ? `Logotyp för ${data.kundnamn}` : 'Företagslogotyp';
  const rotAlt = 'Information om ROT-avdrag (skattereduktion)';

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text>{title}</Text>
        </View>

        {/* Logo if provided */}
        {logoUrl && (
          <View style={{ alignItems: 'center', marginBottom: 20 }}>
            <Image src={logoUrl} style={{ width: 100, height: 50 }} alt={logoAlt} />
          </View>
        )}

        {/* Customer Information */}
        <View style={styles.customerInfo}>
          <Text style={styles.sectionTitle}>KUNDINFORMATION</Text>
          <Text style={styles.text}>Företag: {data.kundnamn}</Text>
          {data.kontaktperson && <Text style={styles.text}>Kontaktperson: {data.kontaktperson}</Text>}
          {data.telefon && <Text style={styles.text}>Telefon: {data.telefon}</Text>}
          {data.email && <Text style={styles.text}>E-post: {data.email}</Text>}
        </View>

        {/* Offer Details */}
        <View style={styles.offerDetails}>
          <Text style={styles.sectionTitle}>OFFERTDETALJER</Text>
          <Text style={styles.text}>Offertnummer: {data.offertId}</Text>
          <Text style={styles.text}>Datum: {data.datum || currentDate}</Text>
          <Text style={styles.text}>Giltig till: {validTill}</Text>
          <Text style={styles.text}>Beskrivning:</Text>
          <Text style={styles.text}>{data.beskrivning}</Text>
        </View>

        {/* Price Section */}
        <View style={styles.priceSection}>
          <Text style={styles.sectionTitle}>PRIS</Text>
          <Text style={styles.price}>{data.pris}</Text>
        </View>

        {/* ROT Image if provided */}
        {rotImageUrl && (
          <View style={{ alignItems: 'center', marginTop: 20 }}>
            <Image src={rotImageUrl} style={{ width: 200, height: 100 }} alt={rotAlt} />
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <Text>Tack för ditt förtroende!</Text>
          <Text>Denna offert är giltig i 30 dagar från ovanstående datum.</Text>
        </View>
      </Page>
    </Document>
  );
};

export default OfferPdf;
