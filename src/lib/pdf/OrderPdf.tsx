import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

// Define the OrderData type
export interface OrderData {
  kundnamn: string;
  kundadress: string;
  kundpostnummer: string;
  kundort: string;
  kontaktperson?: string;
  telefon?: string;
  email?: string;
  ordernummer: string;
  orderdatum: string;
  beskrivning: string;
  rader: Array<{
    text: string;
    antal: number;
    pris: number;
    totalt: number;
  }>;
  summa: number;
  moms: number;
  totalt: number;
  villkor?: string;
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
  orderDetails: {
    backgroundColor: '#FFFFFF',
    border: '1px solid #DDDDDD',
    padding: 15,
    borderRadius: 5,
    marginBottom: 20,
  },
  table: {
    display: 'table',
    width: 'auto',
    borderStyle: 'solid',
    borderWidth: 1,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    marginBottom: 20,
  },
  tableRow: {
    margin: 'auto',
    flexDirection: 'row',
  },
  tableCol: {
    width: '25%',
    borderStyle: 'solid',
    borderWidth: 1,
    borderLeftWidth: 0,
    borderTopWidth: 0,
  },
  tableCell: {
    margin: 'auto',
    marginTop: 5,
    fontSize: 10,
    padding: 5,
  },
  tableHeader: {
    backgroundColor: '#F0F0F0',
    fontWeight: 'bold',
  },
  totalsSection: {
    backgroundColor: '#E8F4FD',
    padding: 15,
    borderRadius: 5,
    marginTop: 20,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  totalLabel: {
    fontSize: 12,
    color: '#666666',
  },
  totalValue: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#333333',
  },
  grandTotal: {
    fontSize: 14,
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

// Define the OrderPdf component
interface OrderPdfProps {
  data: OrderData;
}

const OrderPdf: React.FC<OrderPdfProps> = ({ data }) => {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text>ORDERBEKRÄFTELSE</Text>
        </View>

        {/* Customer Information */}
        <View style={styles.customerInfo}>
          <Text style={styles.sectionTitle}>KUNDINFORMATION</Text>
          <Text style={styles.text}>Företag: {data.kundnamn}</Text>
          <Text style={styles.text}>Adress: {data.kundadress}</Text>
          <Text style={styles.text}>{data.kundpostnummer} {data.kundort}</Text>
          {data.kontaktperson && <Text style={styles.text}>Kontaktperson: {data.kontaktperson}</Text>}
          {data.telefon && <Text style={styles.text}>Telefon: {data.telefon}</Text>}
          {data.email && <Text style={styles.text}>E-post: {data.email}</Text>}
        </View>

        {/* Order Details */}
        <View style={styles.orderDetails}>
          <Text style={styles.sectionTitle}>ORDERDETALJER</Text>
          <Text style={styles.text}>Ordernummer: {data.ordernummer}</Text>
          <Text style={styles.text}>Orderdatum: {data.orderdatum}</Text>
          <Text style={styles.text}>Beskrivning: {data.beskrivning}</Text>
        </View>

        {/* Items Table */}
        <View style={styles.table}>
          {/* Table Header */}
          <View style={[styles.tableRow, styles.tableHeader]}>
            <View style={styles.tableCol}>
              <Text style={[styles.tableCell, styles.tableHeader]}>Beskrivning</Text>
            </View>
            <View style={styles.tableCol}>
              <Text style={[styles.tableCell, styles.tableHeader]}>Antal</Text>
            </View>
            <View style={styles.tableCol}>
              <Text style={[styles.tableCell, styles.tableHeader]}>À-pris</Text>
            </View>
            <View style={styles.tableCol}>
              <Text style={[styles.tableCell, styles.tableHeader]}>Totalt</Text>
            </View>
          </View>
          
          {/* Table Rows */}
          {data.rader.map((rad, index) => (
            <View style={styles.tableRow} key={index}>
              <View style={styles.tableCol}>
                <Text style={styles.tableCell}>{rad.text}</Text>
              </View>
              <View style={styles.tableCol}>
                <Text style={styles.tableCell}>{rad.antal}</Text>
              </View>
              <View style={styles.tableCol}>
                <Text style={styles.tableCell}>{rad.pris.toFixed(2)} kr</Text>
              </View>
              <View style={styles.tableCol}>
                <Text style={styles.tableCell}>{rad.totalt.toFixed(2)} kr</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Totals Section */}
        <View style={styles.totalsSection}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Summa exkl. moms:</Text>
            <Text style={styles.totalValue}>{data.summa.toFixed(2)} kr</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Moms (25%):</Text>
            <Text style={styles.totalValue}>{data.moms.toFixed(2)} kr</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Totalt:</Text>
            <Text style={[styles.totalValue, styles.grandTotal]}>{data.totalt.toFixed(2)} kr</Text>
          </View>
        </View>

        {/* Terms and Conditions */}
        {data.villkor && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>VILLKOR</Text>
            <Text style={styles.text}>{data.villkor}</Text>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <Text>Tack för din beställning!</Text>
          <Text>Vi kommer att leverera enligt ovanstående specifikationer.</Text>
        </View>
      </Page>
    </Document>
  );
};

export default OrderPdf;
