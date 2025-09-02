// src/lib/export.ts
import { Bill } from '../app/bills/page';

export interface SIERecord {
  recordType: string;
  data: string[];
}

export function exportToSIE(bills: Bill[], companyName: string = "Ditt Företag"): string {
  const records: SIERecord[] = [];
  
  // Header
  records.push({ recordType: "#FLAGGA", data: ["0"] });
  records.push({ recordType: "#PROGRAM", data: ["Offertplattform", "1.0"] });
  records.push({ recordType: "#FORMAT", data: ["PC8"] });
  records.push({ recordType: "#GEN", data: [new Date().toISOString().split('T')[0]] });
  records.push({ recordType: "#SIETYP", data: ["4"] });
  records.push({ recordType: "#FNAMN", data: [`"${companyName}"`] });
  
  // Account plan
  records.push({ recordType: "#KONTO", data: ["2440", `"Leverantörsskulder"`] });
  records.push({ recordType: "#KONTO", data: ["6540", `"Övriga externa kostnader"`] });
  
  // Transactions
  bills.forEach((bill, index) => {
    const verNumber = (index + 1).toString();
    const date = bill.paidAt ? new Date(bill.paidAt).toISOString().split('T')[0].replace(/-/g, '') : 
                 new Date(bill.dueDate).toISOString().split('T')[0].replace(/-/g, '');
    
    records.push({ recordType: "#VER", data: ["", verNumber, date, `"Faktura ${bill.vendor}"`, date] });
    records.push({ recordType: "{", data: [] });
    
    // Debit expense account
    records.push({ recordType: "#TRANS", data: ["6540", "{}", bill.amountSEK.toString(), date, `"${bill.vendor} ${bill.invoiceNumber || ''}"`] });
    
    // Credit supplier account (negative amount)
    records.push({ recordType: "#TRANS", data: ["2440", "{}", (-bill.amountSEK).toString(), date, `"${bill.vendor}"`] });
    
    records.push({ recordType: "}", data: [] });
  });
  
  // Convert to SIE format
  return records.map(record => {
    if (record.recordType === "{" || record.recordType === "}") {
      return record.recordType;
    }
    return `${record.recordType} ${record.data.join(' ')}`;
  }).join('\n');
}

export function exportToCSV(bills: Bill[]): string {
  const headers = [
    'Datum',
    'Leverantör',
    'Belopp',
    'Förfallodatum',
    'Fakturanummer',
    'Status',
    'Betaldatum'
  ];
  
  const rows = bills.map(bill => [
    new Date(bill.createdAt).toLocaleDateString('sv-SE'),
    `"${bill.vendor}"`,
    bill.amountSEK.toString().replace('.', ','),
    bill.dueDate,
    bill.invoiceNumber || '',
    bill.paidAt ? 'Betald' : 'Obetald',
    bill.paidAt ? new Date(bill.paidAt).toLocaleDateString('sv-SE') : ''
  ]);
  
  return [headers.join(';'), ...rows.map(row => row.join(';'))].join('\n');
}

export function exportToExcel(bills: Bill[]): Blob {
  // Simple Excel-compatible CSV with BOM
  const csv = exportToCSV(bills);
  const bom = '\uFEFF'; // UTF-8 BOM for Excel compatibility
  return new Blob([bom + csv], { type: 'text/csv;charset=utf-8' });
}

export function downloadFile(content: string | Blob, filename: string, mimeType: string = 'text/plain') {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
}

export function generateWeeklySummary(bills: Bill[]): string {
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay() + 1); // Monday
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6); // Sunday
  
  const thisWeekBills = bills.filter(bill => {
    const dueDate = new Date(bill.dueDate);
    return dueDate >= weekStart && dueDate <= weekEnd && !bill.paidAt;
  });
  
  const totalAmount = thisWeekBills.reduce((sum, bill) => sum + bill.amountSEK, 0);
  
  const summary = `
📅 Veckosammanfattning ${weekStart.toLocaleDateString('sv-SE')} - ${weekEnd.toLocaleDateString('sv-SE')}

💰 Veckans förfallande fakturor: ${thisWeekBills.length} st
💵 Totalt belopp: ${totalAmount.toFixed(2)} kr

${thisWeekBills.length > 0 ? '📋 Fakturor som förfaller:' : '✅ Inga fakturor förfaller denna vecka!'}
${thisWeekBills.map(bill => 
  `• ${bill.vendor}: ${bill.amountSEK.toFixed(2)} kr (${bill.dueDate})`
).join('\n')}

${thisWeekBills.length > 0 ? '\n🔔 Glöm inte att betala i tid!' : ''}
  `.trim();
  
  return summary;
}
