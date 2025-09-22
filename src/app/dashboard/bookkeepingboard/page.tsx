'use client';

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import LogoutButton from "@/components/LogoutButton";

// ===== Same storage keys as dashboard =====
const BK_KEY = 'bookkeeping_entries';
const IDB_DB = 'paperflow-bk';
const IDB_STORE = 'files';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_DB, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function idbGet(key: string): Promise<Blob | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readonly');
    const req = tx.objectStore(IDB_STORE).get(key);
    req.onsuccess = () => resolve(req.result as Blob | undefined);
    req.onerror = () => reject(req.error);
  });
}

 type EntryType = 'invoice' | 'expense';
 type Status = 'Bokförd' | 'Att bokföra';
 type BookkeepEntry = {
  id: string;
  type: EntryType;
  customerId?: string | null;
  customerName?: string;
  invoiceNo?: string;
  supplierName?: string;
  invoiceDate: string;
  amountInclVat: number;
  vatAmount: number;
  fileKey?: string;
  fileMime?: string;
  status: Status;
  publicUrl?: string;
};

function formatCurrency(n: number) {
  return new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK' }).format(n || 0);
}

export default function BookkeepingBoardPage() {
  const [entries, setEntries] = useState<BookkeepEntry[]>([]);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const objectUrlsRef = useRef<string[]>([]);

  // Filters
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<'all'|'invoice'|'expense'>('all');

  // GPT Chat
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Load from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(BK_KEY);
      setEntries(raw ? JSON.parse(raw) : []);
    } catch { setEntries([]); }
  }, []);

  // Build previews from IndexedDB
  useEffect(() => {
    (async () => {
      const map: Record<string, string> = {};
      objectUrlsRef.current.forEach((u) => URL.revokeObjectURL(u));
      objectUrlsRef.current = [];
      for (const e of entries) {
        if (!e.fileKey) continue;
        const blob = await idbGet(e.fileKey);
        if (!blob) continue;
        const url = URL.createObjectURL(blob);
        objectUrlsRef.current.push(url);
        map[e.id] = url;
      }
      setPreviews(map);
    })();
    return () => {
      objectUrlsRef.current.forEach((u) => URL.revokeObjectURL(u));
      objectUrlsRef.current = [];
    };
  }, [entries]);

  // Global summaries (all data)
  const globalTotals = useMemo(() => {
    const income = entries.filter(e => e.type === 'invoice');
    const expense = entries.filter(e => e.type === 'expense');
    const incomeSum = income.reduce((s, x) => s + (x.amountInclVat || 0), 0);
    const expenseSum = expense.reduce((s, x) => s + (x.amountInclVat || 0), 0);
    const outVat = income.reduce((s, x) => s + (x.vatAmount || 0), 0);
    const inVat = expense.reduce((s, x) => s + (x.vatAmount || 0), 0);
    return { incomeSum, expenseSum, result: incomeSum - expenseSum, vatToPay: outVat - inVat };
  }, [entries]);

  const monthOptions = useMemo(() => {
    const set = new Set<string>();
    for (const e of entries) {
      const m = (e.invoiceDate || '').slice(0,7);
      if (m) set.add(m);
    }
    return Array.from(set).sort().reverse();
  }, [entries]);

  const displayedEntries = useMemo(() => {
    let list = entries;
    if (selectedMonth !== 'all') list = list.filter(e => (e.invoiceDate || '').startsWith(selectedMonth));
    if (typeFilter !== 'all') list = list.filter(e => e.type === typeFilter);
    return list;
  }, [entries, selectedMonth, typeFilter]);

  const filteredSums = useMemo(() => {
    const list = displayedEntries;
    const sumIncl = list.reduce((s,x)=> s + (x.amountInclVat || 0), 0);
    const sumVat  = list.reduce((s,x)=> s + (x.vatAmount || 0), 0);
    return { sumIncl, sumVat, count: list.length };
  }, [displayedEntries]);

  // Ask GPT
  const askGPT = async () => {
    if (!question.trim()) return;
    
    setIsLoading(true);
    try {
      const response = await fetch('/api/gpt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: question.trim(),
          context: globalTotals
        })
      });
      
      const data = await response.json();
      if (data.answer) {
        setAnswer(data.answer);
      } else {
        setAnswer('Kunde inte få svar från AI-assistenten.');
      }
    } catch (error) {
      setAnswer('Ett fel uppstod när jag försökte få svar.');
    } finally {
      setIsLoading(false);
    }
  };

  // Draw simple monthly bar chart
  useEffect(() => {
    const canvas = document.getElementById('bk-mini-chart') as HTMLCanvasElement | null;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const map: Record<string, number> = {};
    for (const e of displayedEntries) {
      const ym = (e.invoiceDate || '').slice(0,7);
      if (!ym) continue;
      map[ym] = (map[ym] || 0) + (e.amountInclVat || 0);
    }
    const labels = Object.keys(map).sort();
    const values = labels.map(k => map[k]);

    const width = (labels.length || 6) * 56;
    const height = 140;
    canvas.width = Math.max(width, 360);
    canvas.height = height;

    ctx.clearRect(0,0,canvas.width, canvas.height);
    const max = Math.max(1, ...values);
    const padL = 36, padB = 22, barW = 28, gap = 26;
    labels.forEach((lab, i) => {
      const x = padL + i * (barW + gap);
      const h = Math.round(((values[i] || 0) / max) * (height - padB - 14));
      const y = height - padB - h;
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(x, y, barW, h);
      ctx.fillStyle = '#6b7280';
      ctx.font = '10px system-ui, sans-serif';
      ctx.fillText(lab.slice(2), x-2, height - 6);
    });
  }, [displayedEntries]);

  // Helper function to load company settings
  function getCompanySettings() {
    let companySettings = {
      companyName: "PaperflowAI Kund",
      orgNumber: "5561234567"
    };
    
    try {
      const saved = localStorage.getItem('company_settings');
      if (saved) {
        const settings = JSON.parse(saved);
        companySettings = {
          companyName: settings.companyName || "PaperflowAI Kund",
          orgNumber: settings.orgNumber || "5561234567"
        };
      }
    } catch (error) {
      console.error('Error loading company settings:', error);
    }
    
    return companySettings;
  }

  // Helper function to load chart of accounts
  function getChartOfAccounts() {
    const defaultAccounts = {
      '3001': 'Försäljning',
      '4010': 'Inköp',
      '2640': 'Utgående moms',
      '2641': 'Inkommande moms',
      '1930': 'Kassa/Bank'
    };
    
    try {
      const saved = localStorage.getItem('chart_of_accounts');
      if (saved) {
        const accounts = JSON.parse(saved);
        const accountMap: Record<string, string> = {};
        accounts.forEach((acc: any) => {
          accountMap[acc.number] = acc.name;
        });
        return accountMap;
      }
    } catch (error) {
      console.error('Error loading chart of accounts:', error);
    }
    
    return defaultAccounts;
  }

  function exportCsv(list: BookkeepEntry[]) {
    const rows = [
      ["Typ","Datum","Kund/Leverantör","Nr","Belopp inkl","Moms","Status"],
      ...list.map(e => [
        e.type,
        e.invoiceDate,
        e.type === 'invoice' ? (e.customerName || '') : (e.supplierName || ''),
        e.invoiceNo || '',
        String(e.amountInclVat ?? ''),
        String(e.vatAmount ?? ''),
        e.status
      ])
    ];
    const csv = rows.map(r => r.map(v => `"${String(v??'').replace(/"/g,'""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'bokforing.csv'; a.click();
    setTimeout(()=>URL.revokeObjectURL(url), 1000);
  }

  function exportSIE4(list: BookkeepEntry[]) {
    const now = new Date();
    const companySettings = getCompanySettings();
    const accounts = getChartOfAccounts();
    
    // SIE4 format - fullständig verifikationsnivå
    const sie4Content = [
      `#FLAGGA 0`,
      `#PROGRAM "PaperflowAI" 1.0`,
      `#FORMAT PC8`,
      `#GEN ${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')} "PaperflowAI Bokföring"`,
      `#SIETYP 4`,
      `#ORGNR ${companySettings.orgNumber}`,
      `#FNAMN "${companySettings.companyName}"`,
      `#RAR 0 ${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`,
      `#KPTYP EUBAS97`,
      `#VALUTA SEK`,
      `#KONTO`,
      `#KTYP`,
      `#SRU`,
      `#DIM`,
      `#OBJEKT`,
      `#IB 0 0`,
      `#UB 0 0`,
      `#OIB 0 0`,
      `#OUB 0 0`,
      `#RES 0 0`,
      `#PSALDO`,
      `#PBUDGET`,
      `#VER "A" ${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')} "Bokföring från PaperflowAI"`,
      `#TRANS`,
      ...list.map((entry, index) => {
        const date = entry.invoiceDate.replace(/-/g, '');
        const amount = Math.round(entry.amountInclVat * 100); // SIE4 använder öre
        const vatAmount = Math.round(entry.vatAmount * 100);
        const netAmount = amount - vatAmount;
        
        // Use customizable accounts or fallback to defaults
        const account = entry.type === 'invoice' ? '3001' : '4010'; // Försäljning vs Inköp
        const vatAccount = entry.type === 'invoice' ? '2640' : '2641'; // Utgående vs Inkommande moms
        const bankAccount = '1930'; // Kassa/Bank
        
        const description = entry.type === 'invoice' 
          ? `Faktura ${entry.invoiceNo || ''} till ${entry.customerName || 'Kund'}`
          : `Kvitto ${entry.invoiceNo || ''} från ${entry.supplierName || 'Leverantör'}`;
        
        return [
          `#TRANS ${account} {} ${netAmount} "${description}" ${date}`,
          `#TRANS ${vatAccount} {} ${vatAmount} "Moms ${entry.type === 'invoice' ? 'utgående' : 'inkommande'}" ${date}`,
          `#TRANS ${bankAccount} {} ${-amount} "${accounts[bankAccount] || 'Kassa/Bank'}" ${date}`
        ].join('\n');
      }),
      `#ENHET`,
      `#RTRANS`,
      `#BTRANS`,
      `#KONTO`,
      `#KTYP`,
      `#SRU`,
      `#DIM`,
      `#OBJEKT`,
      `#IB 0 0`,
      `#UB 0 0`,
      `#OIB 0 0`,
      `#OUB 0 0`,
      `#RES 0 0`,
      `#PSALDO`,
      `#PBUDGET`
    ].join('\n');

    const blob = new Blob([sie4Content], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; 
    a.download = `bokforing_sie4_${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}.sie`; 
    a.click();
    setTimeout(()=>URL.revokeObjectURL(url), 1000);
  }

  function exportSIE1(list: BookkeepEntry[]) {
    const now = new Date();
    const companySettings = getCompanySettings();
    
    // SIE1 format - balans och resultat
    const sie1Content = [
      `#FLAGGA 0`,
      `#PROGRAM "PaperflowAI" 1.0`,
      `#FORMAT PC8`,
      `#GEN ${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')} "PaperflowAI Bokföring"`,
      `#SIETYP 1`,
      `#ORGNR ${companySettings.orgNumber}`,
      `#FNAMN "${companySettings.companyName}"`,
      `#RAR 0 ${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`,
      `#KPTYP EUBAS97`,
      `#VALUTA SEK`,
      `#KONTO`,
      `#KTYP`,
      `#SRU`,
      `#DIM`,
      `#OBJEKT`,
      `#IB 0 0`,
      `#UB 0 0`,
      `#OIB 0 0`,
      `#OUB 0 0`,
      `#RES 0 0`,
      `#PSALDO`,
      `#PBUDGET`
    ].join('\n');

    const blob = new Blob([sie1Content], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; 
    a.download = `bokforing_sie1_${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}.sie`; 
    a.click();
    setTimeout(()=>URL.revokeObjectURL(url), 1000);
  }

  function exportSIE2(list: BookkeepEntry[]) {
    const now = new Date();
    const companySettings = getCompanySettings();
    
    // SIE2 format - objektlista
    const sie2Content = [
      `#FLAGGA 0`,
      `#PROGRAM "PaperflowAI" 1.0`,
      `#FORMAT PC8`,
      `#GEN ${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')} "PaperflowAI Bokföring"`,
      `#SIETYP 2`,
      `#ORGNR ${companySettings.orgNumber}`,
      `#FNAMN "${companySettings.companyName}"`,
      `#RAR 0 ${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`,
      `#KPTYP EUBAS97`,
      `#VALUTA SEK`,
      `#KONTO`,
      `#KTYP`,
      `#SRU`,
      `#DIM`,
      `#OBJEKT`,
      `#IB 0 0`,
      `#UB 0 0`,
      `#OIB 0 0`,
      `#OUB 0 0`,
      `#RES 0 0`,
      `#PSALDO`,
      `#PBUDGET`
    ].join('\n');

    const blob = new Blob([sie2Content], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; 
    a.download = `bokforing_sie2_${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}.sie`; 
    a.click();
    setTimeout(()=>URL.revokeObjectURL(url), 1000);
  }

  function exportSIE3(list: BookkeepEntry[]) {
    const now = new Date();
    const companySettings = getCompanySettings();
    
    // SIE3 format - transaktionslista
    const sie3Content = [
      `#FLAGGA 0`,
      `#PROGRAM "PaperflowAI" 1.0`,
      `#FORMAT PC8`,
      `#GEN ${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')} "PaperflowAI Bokföring"`,
      `#SIETYP 3`,
      `#ORGNR ${companySettings.orgNumber}`,
      `#FNAMN "${companySettings.companyName}"`,
      `#RAR 0 ${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`,
      `#KPTYP EUBAS97`,
      `#VALUTA SEK`,
      `#KONTO`,
      `#KTYP`,
      `#SRU`,
      `#DIM`,
      `#OBJEKT`,
      `#IB 0 0`,
      `#UB 0 0`,
      `#OIB 0 0`,
      `#OUB 0 0`,
      `#RES 0 0`,
      `#PSALDO`,
      `#PBUDGET`,
      `#VER "A" ${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')} "Bokföring från PaperflowAI"`,
      `#TRANS`,
      ...list.map((entry) => {
        const date = entry.invoiceDate.replace(/-/g, '');
        const amount = Math.round(entry.amountInclVat * 100);
        const account = entry.type === 'invoice' ? '3001' : '4010';
        const description = entry.type === 'invoice' 
          ? `Faktura ${entry.invoiceNo || ''} till ${entry.customerName || 'Kund'}`
          : `Kvitto ${entry.invoiceNo || ''} från ${entry.supplierName || 'Leverantör'}`;
        
        return `#TRANS ${account} {} ${amount} "${description}" ${date}`;
      })
    ].join('\n');

    const blob = new Blob([sie3Content], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; 
    a.download = `bokforing_sie3_${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}.sie`; 
    a.click();
    setTimeout(()=>URL.revokeObjectURL(url), 1000);
  }

            return (
            <main className="px-3 sm:px-6 md:px-8 py-6 space-y-6 max-w-screen-sm mx-auto md:max-w-6xl md:mx-auto">
              <LogoutButton />
      {/* Tillbaka-knappar */}
      <div className="flex justify-start gap-3 flex-wrap">
        <Link
          href="/dashboard"
          className="bg-gray-600 text-white px-4 py-2 rounded text-sm hover:bg-gray-700 transition-colors"
        >
          ← Tillbaka till kundregister
        </Link>
        {/* OCR-funktion borttagen: länken till fota-kvitto tas bort */}
        <Link
          href="y/dashboard/settings"
          className="bg-purple-600 text-white px-4 py-2 rounded text-sm hover:bg-purple-700 transition-colors"
        >
          ⚙️ Inställningar
        </Link>
        <Link
          href="/dashboard/reports"
          className="bg-indigo-600 text-white px-4 py-2 rounded text-sm hover:bg-indigo-700 transition-colors"
        >
          📊 Rapporter
        </Link>
        <Link
          href="/dashboard/automation"
          className="bg-teal-600 text-white px-4 py-2 rounded text-sm hover:bg-teal-700 transition-colors"
        >
          🤖 Automatisering
        </Link>
        <Link
          href="/dashboard/users"
          className="bg-pink-600 text-white px-4 py-2 rounded text-sm hover:bg-pink-700 transition-colors"
        >
          👥 Användare
        </Link>
        <Link
          href="/dashboard/mobile"
          className="bg-cyan-600 text-white px-4 py-2 rounded text-sm hover:bg-cyan-700 transition-colors"
        >
          📱 Mobil
        </Link>
        <Link
          href="/start"
          className="bg-green-600 text-white px-4 py-2 rounded text-sm hover:bg-green-700 transition-colors"
        >
          🏠 Till Start
        </Link>
      </div>
      
      {/* Header cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card title="Intäkter (inkl.)" value={formatCurrency(globalTotals.incomeSum)} />
        <Card title="Kostnader (inkl.)" value={formatCurrency(globalTotals.expenseSum)} />
        <Card title="Moms att betala" value={formatCurrency(globalTotals.vatToPay)} />
        <Card title="Resultat" value={formatCurrency(globalTotals.result)} />
      </div>

      {/* GPT Chat Assistant */}
      <div className="bg-white rounded-xl border p-4 shadow-sm">
        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <span className="w-6 h-6 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-sm">AI</span>
          Bokföringsassistent
        </h3>
        <div className="space-y-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ställ en fråga om din bokföring, t.ex. 'Vad ska jag betala i moms?'"
              className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              onKeyPress={(e) => e.key === 'Enter' && askGPT()}
            />
            <button
              onClick={askGPT}
              disabled={isLoading || !question.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700"
            >
              {isLoading ? 'Söker...' : 'Fråga'}
            </button>
          </div>
          {answer && (
            <div className="bg-gray-50 rounded-lg p-3 border-l-4 border-blue-500">
              <p className="text-sm text-gray-800">{answer}</p>
            </div>
          )}
        </div>
      </div>

      {/* Sticky controls */}
      <div className="sticky top-[calc(env(safe-area-inset-top,8px)+46px)] z-10 bg-gray-100/80 backdrop-blur rounded border px-3 py-2 flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded overflow-hidden border">
          <button onClick={()=>setTypeFilter('all')} className={`px-3 py-1 text-sm ${typeFilter==='all'?'bg-black text-white':'bg-white'}`}>Alla</button>
          <button onClick={()=>setTypeFilter('invoice')} className={`px-3 py-1 text-sm border-l ${typeFilter==='invoice'?'bg-black text-white':'bg-white'}`}>Intäkter</button>
          <button onClick={()=>setTypeFilter('expense')} className={`px-3 py-1 text-sm border-l ${typeFilter==='expense'?'bg-black text-white':'bg-white'}`}>Kostnader</button>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">Månad:</label>
          <select
            value={selectedMonth}
            onChange={e => setSelectedMonth(e.target.value)}
            className="border rounded px-3 py-1.5 text-sm bg-white"
          >
            <option value="all">Alla</option>
            {monthOptions.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <button
            onClick={() => exportCsv(displayedEntries)}
            className="px-3 py-1.5 rounded bg-gray-600 text-white text-sm hover:bg-gray-700"
            title="Exportera CSV"
          >
            CSV
          </button>
          <button
            onClick={() => exportSIE4(displayedEntries)}
            className="px-3 py-1.5 rounded bg-blue-600 text-white text-sm hover:bg-blue-700"
            title="Exportera SIE4 - Fullständig verifikationsnivå för revisorer"
          >
            SIE4
          </button>
          <button
            onClick={() => exportSIE3(displayedEntries)}
            className="px-3 py-1.5 rounded bg-purple-600 text-white text-sm hover:bg-purple-700"
            title="Exportera SIE3 - Transaktionslista"
          >
            SIE3
          </button>
          <button
            onClick={() => exportSIE2(displayedEntries)}
            className="px-3 py-1.5 rounded bg-orange-600 text-white text-sm hover:bg-orange-700"
            title="Exportera SIE2 - Objektlista"
          >
            SIE2
          </button>
          <button
            onClick={() => exportSIE1(displayedEntries)}
            className="px-3 py-1.5 rounded bg-green-600 text-white text-sm hover:bg-green-700"
            title="Exportera SIE1 - Balans och resultat"
          >
            SIE1
          </button>
        </div>
      </div>

      {/* Mini-diagram */}
      <div className="overflow-x-auto">
        <canvas id="bk-mini-chart" className="border rounded bg-white"></canvas>
      </div>

      {/* Table */}
      {displayedEntries.length > 0 ? (
        <div className="overflow-x-auto rounded border bg-white">
          <table className="min-w-full text-sm">
            <thead className="text-left border-b bg-gray-50">
              <tr>
                <th className="py-3 px-3">Bilaga</th>
                <th className="py-3 px-3">Typ</th>
                <th className="py-3 px-3">Datum</th>
                <th className="py-3 px-3">Kund/Leverantör</th>
                <th className="py-3 px-3">Nr</th>
                <th className="py-3 px-3 text-right">Belopp (inkl.)</th>
                <th className="py-3 px-3 text-right">Moms</th>
                <th className="py-3 px-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {displayedEntries.map(e => (
                <tr key={e.id} className="border-b last:border-0 align-middle hover:bg-gray-50">
                  <td className="py-2 px-3">
                    {e.fileKey ? (
                      e.fileMime?.startsWith('image/') ? (
                        <div className="relative inline-block">
                          {(previews[e.id] || (e as any).publicUrl) ? (
                            <a href={previews[e.id] || (e as any).publicUrl} target="_blank" rel="noreferrer" title="Öppna kvitto">
                              <img src={previews[e.id] || (e as any).publicUrl} alt="Bilaga" className="h-12 w-auto rounded border" />
                            </a>
                          ) : (
                            <div className="h-12 w-12 grid place-items-center rounded border text-xs text-gray-400">—</div>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          {(previews[e.id] || (e as any).publicUrl) ? (
                            <a
                              href={previews[e.id] || (e as any).publicUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-blue-600 underline"
                              title="Öppna bilaga"
                            >
                              Öppna bilaga
                            </a>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </div>
                      )
                    ) : (
                      (e as any).publicUrl ? (
                        <a href={(e as any).publicUrl} target="_blank" rel="noreferrer" className="text-blue-600 underline">Öppna bilaga (moln)</a>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )
                    )}
                  </td>
                  <td className="py-2 px-3">{e.type === 'invoice' ? <Badge color="emerald">Faktura</Badge> : <Badge color="indigo">Kvitto</Badge>}</td>
                  <td className="py-2 px-3">{e.invoiceDate}</td>
                  <td className="py-2 px-3">{e.type === 'invoice' ? (e.customerName || '-') : (e.supplierName || '-')}</td>
                  <td className="py-2 px-3">{e.invoiceNo || '-'}</td>
                  <td className="py-2 px-3 text-right">{formatCurrency(e.amountInclVat)}</td>
                  <td className="py-2 px-3 text-right">{formatCurrency(e.vatAmount)}</td>
                  <td className="py-2 px-3">{e.status === 'Bokförd' ? <Badge color="emerald">Bokförd</Badge> : <Badge color="amber">Att bokföra</Badge>}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-semibold bg-gray-50">
                <td className="py-3 px-3" colSpan={5}>Summa ({filteredSums.count} rader)</td>
                <td className="py-3 px-3 text-right">{formatCurrency(filteredSums.sumIncl)}</td>
                <td className="py-3 px-3 text-right">{formatCurrency(filteredSums.sumVat)}</td>
                <td className="py-3 px-3"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <p className="text-gray-500">Ingen bokföring för vald period.</p>
      )}
    </main>
  );
}

function Card({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-xl border p-4 bg-white shadow-sm">
      <p className="text-xs text-gray-500">{title}</p>
      <p className="text-lg font-semibold mt-1">{value}</p>
    </div>
  );
}

function Badge({ color, children }: { color: 'emerald'|'indigo'|'amber'; children: React.ReactNode }) {
  const cls = color === 'emerald'
    ? 'bg-emerald-100 text-emerald-800'
    : color === 'indigo'
    ? 'bg-indigo-100 text-indigo-800'
    : 'bg-amber-100 text-amber-800';
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs ${cls}`}>{children}</span>;
}
