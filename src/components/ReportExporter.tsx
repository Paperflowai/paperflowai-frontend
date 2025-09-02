// src/components/ReportExporter.tsx
"use client";

import { useState } from 'react';
import { 
  TimeEntry,
  calculateTimeStats,
  getWeeklyTrends,
  exportTimeReport,
  formatMinutes
} from '@/lib/timeAnalytics';

interface ReportExporterProps {
  entries: TimeEntry[];
}

export default function ReportExporter({ entries }: ReportExporterProps) {
  const [exportType, setExportType] = useState<'pdf' | 'excel' | 'csv'>('pdf');
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });
  const [reportType, setReportType] = useState<'summary' | 'detailed' | 'trends'>('summary');
  const [isExporting, setIsExporting] = useState(false);

  async function handleExport() {
    setIsExporting(true);
    
    try {
      const startDate = new Date(dateRange.start);
      const endDate = new Date(dateRange.end);
      
      if (exportType === 'csv') {
        await exportToCSV(startDate, endDate);
      } else if (exportType === 'excel') {
        await exportToExcel(startDate, endDate);
      } else {
        await exportToPDF(startDate, endDate);
      }
    } catch (error) {
      console.error('Export failed:', error);
      alert('Export misslyckades. Försök igen.');
    } finally {
      setIsExporting(false);
    }
  }

  async function exportToCSV(startDate: Date, endDate: Date) {
    const filteredEntries = entries.filter(e => {
      const entryDate = new Date(e.date);
      return entryDate >= startDate && entryDate <= endDate;
    });

    let csvContent = '';
    
    if (reportType === 'summary') {
      const stats = calculateTimeStats(filteredEntries, startDate, endDate);
      csvContent = `Tidsrapport Sammanfattning;${startDate.toLocaleDateString('sv-SE')} - ${endDate.toLocaleDateString('sv-SE')}\n\n`;
      csvContent += `Total tid;${formatMinutes(stats.totalMinutes)}\n`;
      csvContent += `Fakturerbar tid;${formatMinutes(stats.billableMinutes)}\n`;
      csvContent += `Icke-fakturerbar tid;${formatMinutes(stats.nonBillableMinutes)}\n`;
      csvContent += `Produktivitet;${stats.productivity}%\n\n`;
      
      csvContent += `Kund;Tid;Procent\n`;
      stats.customerBreakdown.forEach(c => {
        csvContent += `${c.customer};${formatMinutes(c.minutes)};${c.percentage}%\n`;
      });
    } else if (reportType === 'detailed') {
      csvContent = `Datum;Kund;Projekt;Tid;Fakturerad;Anteckning\n`;
      filteredEntries.forEach(e => {
        csvContent += `${e.date};${e.customer || ''};${e.project || ''};${formatMinutes(e.minutes)};${e.billedAt ? 'Ja' : 'Nej'};${e.note || ''}\n`;
      });
    } else {
      const trends = getWeeklyTrends(filteredEntries, 12);
      csvContent = `Vecka;Total tid;Fakturerbar tid;Produktivitet\n`;
      trends.forEach(t => {
        csvContent += `${t.weekKey};${formatMinutes(t.totalMinutes)};${formatMinutes(t.billableMinutes)};${t.productivity}%\n`;
      });
    }

    downloadFile(csvContent, `tidsrapport_${reportType}_${dateRange.start}_${dateRange.end}.csv`, 'text/csv');
  }

  async function exportToExcel(startDate: Date, endDate: Date) {
    // Create Excel-compatible CSV with BOM
    const csvContent = await generateCSVContent(startDate, endDate);
    const bom = '\uFEFF';
    const blob = new Blob([bom + csvContent], { type: 'application/vnd.ms-excel;charset=utf-8' });
    
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `tidsrapport_${reportType}_${dateRange.start}_${dateRange.end}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  async function exportToPDF(startDate: Date, endDate: Date) {
    const reportText = exportTimeReport(entries, startDate, endDate);
    
    // Create a simple HTML version for PDF
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Tidsrapport</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        h1 { color: #333; border-bottom: 2px solid #0ea5e9; }
        h2 { color: #666; margin-top: 30px; }
        .summary { background: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0; }
        .breakdown { margin: 20px 0; }
        .entry { margin: 5px 0; padding: 5px; border-bottom: 1px solid #eee; }
        @media print { body { margin: 0; } }
    </style>
</head>
<body>
    <pre style="white-space: pre-wrap; font-family: Arial, sans-serif;">${reportText}</pre>
</body>
</html>`;

    // Create blob and download
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    
    // Open in new window for printing
    const printWindow = window.open(url, '_blank');
    if (printWindow) {
      printWindow.onload = () => {
        setTimeout(() => {
          printWindow.print();
          printWindow.close();
          URL.revokeObjectURL(url);
        }, 500);
      };
    }
  }

  async function generateCSVContent(startDate: Date, endDate: Date): Promise<string> {
    const filteredEntries = entries.filter(e => {
      const entryDate = new Date(e.date);
      return entryDate >= startDate && entryDate <= endDate;
    });

    if (reportType === 'summary') {
      const stats = calculateTimeStats(filteredEntries, startDate, endDate);
      let content = `Tidsrapport Sammanfattning;${startDate.toLocaleDateString('sv-SE')} - ${endDate.toLocaleDateString('sv-SE')}\n\n`;
      content += `Total tid;${formatMinutes(stats.totalMinutes)}\n`;
      content += `Fakturerbar tid;${formatMinutes(stats.billableMinutes)}\n`;
      content += `Icke-fakturerbar tid;${formatMinutes(stats.nonBillableMinutes)}\n`;
      content += `Produktivitet;${stats.productivity}%\n\n`;
      
      content += `Kund;Tid;Procent\n`;
      stats.customerBreakdown.forEach(c => {
        content += `${c.customer};${formatMinutes(c.minutes)};${c.percentage}%\n`;
      });
      return content;
    } else if (reportType === 'detailed') {
      let content = `Datum;Kund;Projekt;Tid;Fakturerad;Anteckning\n`;
      filteredEntries.forEach(e => {
        content += `${e.date};${e.customer || ''};${e.project || ''};${formatMinutes(e.minutes)};${e.billedAt ? 'Ja' : 'Nej'};${e.note || ''}\n`;
      });
      return content;
    } else {
      const trends = getWeeklyTrends(filteredEntries, 12);
      let content = `Vecka;Total tid;Fakturerbar tid;Produktivitet\n`;
      trends.forEach(t => {
        content += `${t.weekKey};${formatMinutes(t.totalMinutes)};${formatMinutes(t.billableMinutes)};${t.productivity}%\n`;
      });
      return content;
    }
  }

  function downloadFile(content: string, filename: string, mimeType: string) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
  }

  async function generateQuickReport() {
    const last30Days = entries.filter(e => {
      const entryDate = new Date(e.date);
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      return entryDate >= thirtyDaysAgo;
    });

    const stats = calculateTimeStats(last30Days);
    
    const report = `📊 SNABBRAPPORT - SENASTE 30 DAGARNA

⏱️ TOTAL TID: ${formatMinutes(stats.totalMinutes)}
💰 FAKTURERBAR: ${formatMinutes(stats.billableMinutes)} (${Math.round((stats.billableMinutes / stats.totalMinutes) * 100)}%)
📈 PRODUKTIVITET: ${stats.productivity}%
📅 DAGLIGT SNITT: ${formatMinutes(stats.dailyAverage)}

🏢 TOPP KUNDER:
${stats.customerBreakdown.slice(0, 5).map(c => 
  `• ${c.customer}: ${formatMinutes(c.minutes)} (${c.percentage}%)`
).join('\n')}

📋 TOPP PROJEKT:
${stats.projectBreakdown.slice(0, 5).map(p => 
  `• ${p.project}: ${formatMinutes(p.minutes)} (${p.percentage}%)`
).join('\n')}`;

    // Copy to clipboard
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(report);
      alert('Snabbrapport kopierad till urklipp!');
    } else {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = report;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      alert('Snabbrapport kopierad till urklipp!');
    }
  }

  const filteredEntries = entries.filter(e => {
    const entryDate = new Date(e.date);
    const startDate = new Date(dateRange.start);
    const endDate = new Date(dateRange.end);
    return entryDate >= startDate && entryDate <= endDate;
  });

  const stats = calculateTimeStats(filteredEntries);

  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, background: '#fff', padding: 16 }}>
      <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>Exportera rapporter</h3>

      {/* Quick actions */}
      <div style={{ marginBottom: 16, padding: 12, background: '#f8fafc', borderRadius: 8 }}>
        <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Snabbåtgärder</h4>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            onClick={generateQuickReport}
            style={{
              padding: '8px 16px',
              borderRadius: 6,
              border: '1px solid #0ea5e9',
              background: '#0ea5e9',
              color: 'white',
              fontSize: 14
            }}
          >
            📋 Snabbrapport (30 dagar)
          </button>
          <button
            onClick={() => {
              const today = new Date();
              const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
              setDateRange({
                start: firstDayOfMonth.toISOString().split('T')[0],
                end: today.toISOString().split('T')[0]
              });
            }}
            style={{
              padding: '8px 16px',
              borderRadius: 6,
              border: '1px solid #10b981',
              background: '#10b981',
              color: 'white',
              fontSize: 14
            }}
          >
            📅 Denna månad
          </button>
        </div>
      </div>

      {/* Export configuration */}
      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', marginBottom: 16 }}>
        <div>
          <label style={{ display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
            Rapporttyp
          </label>
          <select
            value={reportType}
            onChange={(e) => setReportType(e.target.value as any)}
            style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #ddd' }}
          >
            <option value="summary">Sammanfattning</option>
            <option value="detailed">Detaljerad lista</option>
            <option value="trends">Trender & utveckling</option>
          </select>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
            Format
          </label>
          <select
            value={exportType}
            onChange={(e) => setExportType(e.target.value as any)}
            style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #ddd' }}
          >
            <option value="pdf">PDF (för utskrift)</option>
            <option value="excel">Excel (.xlsx)</option>
            <option value="csv">CSV (kommaseparerad)</option>
          </select>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
            Från datum
          </label>
          <input
            type="date"
            value={dateRange.start}
            onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
            style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #ddd' }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
            Till datum
          </label>
          <input
            type="date"
            value={dateRange.end}
            onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
            style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #ddd' }}
          />
        </div>
      </div>

      {/* Preview stats */}
      <div style={{ marginBottom: 16, padding: 12, background: '#ecfeff', borderRadius: 8 }}>
        <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Förhandsvisning</h4>
        <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))' }}>
          <div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>Poster</div>
            <div style={{ fontSize: 16, fontWeight: 600 }}>{filteredEntries.length}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>Total tid</div>
            <div style={{ fontSize: 16, fontWeight: 600 }}>{formatMinutes(stats.totalMinutes)}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>Fakturerbar</div>
            <div style={{ fontSize: 16, fontWeight: 600 }}>{formatMinutes(stats.billableMinutes)}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>Produktivitet</div>
            <div style={{ fontSize: 16, fontWeight: 600 }}>{stats.productivity}%</div>
          </div>
        </div>
      </div>

      {/* Export button */}
      <button
        onClick={handleExport}
        disabled={isExporting || filteredEntries.length === 0}
        style={{
          width: '100%',
          padding: '12px 24px',
          borderRadius: 8,
          border: '1px solid #0ea5e9',
          background: isExporting ? '#e5e7eb' : '#0ea5e9',
          color: isExporting ? '#6b7280' : 'white',
          fontSize: 16,
          fontWeight: 600
        }}
      >
        {isExporting ? 'Exporterar...' : `📤 Exportera ${exportType.toUpperCase()}`}
      </button>

      {filteredEntries.length === 0 && (
        <div style={{ color: '#ef4444', fontSize: 14, textAlign: 'center', marginTop: 8 }}>
          Inga tidposter i valt datumintervall
        </div>
      )}
    </div>
  );
}
