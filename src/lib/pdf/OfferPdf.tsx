import React from "react";
import { Document, Page, Text, View, Image, StyleSheet } from "@react-pdf/renderer";

type LineItem = {
  beskrivning: string;
  antal?: number;
  ápris?: number;
  summa?: number;
};

type OfferDataMinimal = {
  offertnummer?: string;
  datum?: string;
  kundnamn?: string;
  poster?: LineItem[];
  total?: number;
};

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 12 },
  header: { marginBottom: 16 },
  title: { fontSize: 18, marginBottom: 8 },
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  tableHeader: { marginTop: 12, marginBottom: 6, fontWeight: 700 },
  line: { borderBottomWidth: 1, borderBottomColor: "#e5e7eb", marginVertical: 6 },
  logo: { width: 120, height: 40, objectFit: "contain", marginBottom: 12 },
});

export default function OfferPdf({
  data,
  logoUrl,
  rotImageUrl,
}: {
  data: OfferDataMinimal;
  logoUrl?: string;
  rotImageUrl?: string;
}) {
  const poster = data?.poster ?? [];

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          {logoUrl ? <Image src={logoUrl} style={styles.logo} /> : null}
          <Text style={styles.title}>Offert</Text>
          <View style={styles.row}>
            <Text>Offertnr: {data?.offertnummer ?? "-"}</Text>
            <Text>Datum: {data?.datum ?? "-"}</Text>
          </View>
          <Text>Kund: {data?.kundnamn ?? "-"}</Text>
        </View>

        <Text style={styles.tableHeader}>Rader</Text>
        <View style={styles.line} />

        {poster.length === 0 ? (
          <Text>Inga rader</Text>
        ) : (
          poster.map((p, i) => (
            <View key={i} style={{ marginBottom: 8 }}>
              <Text>{p.beskrivning}</Text>
              <View style={styles.row}>
                <Text>Antal: {p.antal ?? "-"}</Text>
                <Text>à-pris: {p.ápris ?? "-"}</Text>
                <Text>Summa: {p.summa ?? "-"}</Text>
              </View>
              <View style={styles.line} />
            </View>
          ))
        )}

        <View style={{ marginTop: 12 }}>
          <View style={styles.row}>
            <Text style={{ fontWeight: 700 }}>Totalt:</Text>
            <Text style={{ fontWeight: 700 }}>{data?.total ?? "-"}</Text>
          </View>
          {rotImageUrl ? <Image src={rotImageUrl} style={{ width: 120, marginTop: 8 }} /> : null}
        </View>
      </Page>
    </Document>
  );
}
