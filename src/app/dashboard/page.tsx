'use client';
import OpenAccountingCta from "@/components/OpenAccountingCta";
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { supabase } from "../../lib/supabaseClient";
import { uploadPublicBlob } from "@/lib/storage";
import DashboardCounter from "@/components/DashboardCounter";
import LogoutButton from "@/components/LogoutButton";


// =========================
// Typer
// =========================

const AUTH_DISABLED = process.env.NEXT_PUBLIC_DISABLE_AUTH === '1' || process.env.NODE_ENV === 'development';

type Kund = {
  id: string;
  companyName: string;
  orgNr: string;
  contactPerson: string;
  role: string;
  phone: string;
  email: string;
  address: string;
  zip: string;
  city: string;
  country: string;
  contactDate: string;
  notes: string;
  customerNumber: string;
};

type EntryType = 'invoice' | 'expense';
type Status = 'Bokförd' | 'Att bokföra';

type BookkeepEntry = {
  id: string;
  type: EntryType;
  customerId?: string | null;
  customerName?: string;
  invoiceNo?: string;
  supplierName?: string;
  invoiceDate: string; // YYYY-MM-DD
  amountInclVat: number;
  vatAmount: number;
  fileKey?: string; // IndexedDB key
  fileMime?: string; // "image/jpeg" | "application/pdf" | ...
  status: Status;
};

const DEMO_CUSTOMERS = new Set<string>(['Test AB', 'Kund 1', 'Elfixarna AB']);
const BK_KEY = 'bookkeeping_entries';

// =========================
// IndexedDB helpers
// =========================

const DB_NAME = 'paperflow-bk';
const STORE = 'files';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function idbSet(key: string, blob: Blob) {
  const db = await openDB();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(blob, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
async function idbGet(key: string): Promise<Blob | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(key);
    req.onsuccess = () => resolve(req.result as Blob | undefined);
    req.onerror = () => reject(req.error);
  });
}
async function idbDel(key: string) {
  const db = await openDB();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// =========================
// Bildkomprimering
// =========================

async function fileToDataURL(file: File): Promise<string> {
  return await new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = () => rej(r.error);
    r.readAsDataURL(file);
  });
}
function loadHtmlImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
/** JPEG, max 1600px längsta sida, mål < ~600 KB */
async function compressImageToBlob(file: File): Promise<Blob> {
  const origUrl = await fileToDataURL(file);
  const img = await loadHtmlImage(origUrl);

  const maxSide = 1600;
  let { width, height } = img;
  if (width > height && width > maxSide) {
    height = Math.round((height * maxSide) / width);
    width = maxSide;
  } else if (height >= width && height > maxSide) {
    width = Math.round((width * maxSide) / height);
    height = maxSide;
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0, width, height);

  const qualities = [0.75, 0.6, 0.5, 0.4];
  for (const q of qualities) {
    const blob = await new Promise<Blob | null>(r => canvas.toBlob(b => r(b), 'image/jpeg', q));
    if (!blob) continue;
    if (blob.size < 600 * 1024 || q === qualities[qualities.length - 1]) return blob;
  }
  return new Blob();
}

// =========================
// OCR + PARSERS (svenska kvitton) — removed OCR calls
// =========================

/** Normalisera tal som "1 234,50" / "1.234,50" / "1234.50" → 1234.50 */
function parseNumber(s: string): number | null {
  if (!s) return null;
  let t = s.replace(/\s+/g, "");
  if (/,/.test(t) && /\d,\d{1,2}$/.test(t)) {
    t = t.replace(/\./g, "").replace(",", ".");
  } else {
    const parts = t.split(".");
    if (parts.length > 2) {
      const dec = parts.pop();
      t = parts.join("") + "." + dec;
    }
  }
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** Plocka datum i format YYYY-MM-DD, DD-MM-YYYY, 12 aug 2025 etc. */
function parseDateFromText(text: string): string | null {
  const t = text.replace(/\s+/g, " ");

  const m1 = t.match(/\b(20\d{2})[-\/.](0?[1-9]|1[0-2])[-\/.](0?[1-9]|[12]\d|3[01])\b/);
  if (m1) {
    const y = m1[1], M = m1[2].padStart(2, "0"), d = m1[3].padStart(2, "0");
    return `${y}-${M}-${d}`;
  }
  const m2 = t.match(/\b(0?[1-9]|[12]\d|3[01])[-\/.](0?[1-9]|1[0-2])[-\/.](20\d{2})\b/);
  if (m2) {
    const d = m2[1].padStart(2, "0"), M = m2[2].padStart(2, "0"), y = m2[3];
    return `${y}-${M}-${d}`;
  }

  const months: Record<string,string> = {
    jan:"01", januari:"01", feb:"02", februari:"02", mar:"03", mars:"03",
    apr:"04", april:"04", maj:"05", jun:"06", juni:"06",
    jul:"07", juli:"07", aug:"08", augusti:"08",
    sep:"09", sept:"09", september:"09", okt:"10", oktober:"10",
    nov:"11", november:"11", dec:"12", december:"12"
  };
  const m3 = t.match(/\b(0?[1-9]|[12]\d|3[01])\s+([A-Za-zåäöÅÄÖ]{3,9})\s+(20\d{2})\b/);
  if (m3) {
    const d = m3[1].padStart(2,"0");
    const mname = m3[2].toLowerCase();
    const y = m3[3];
    const M = months[mname];
    if (M) return `${y}-${M}-${d}`;
  }

  return null;
}

/** Kända kedjor */
const KNOWN_SUPPLIERS = [
  'Byggmax','Bauhaus','Hornbach','Beijer','Ahlsell','XL Bygg','K-rauta','Clas Ohlson','Jula','Biltema',
  'Circle K','OKQ8','Preem','Shell','St1',
  'Ica','Coop','Willys','Hemköp','Lidl','City Gross','Rusta','Dollarstore',
  'Elgiganten','MediaMarkt','NetOnNet',
  'Apoteket','Kronans Apotek','Apotea',
  'Systembolaget','Postnord','SJ','IKEA','Direkten','Pressbyrån'
];

function normalizeSupplierName(s: string): string {
  const cleaned = s
    .replace(/[^A-Za-zÅÄÖåäö&.\-\s]/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return cleaned
    .toLowerCase()
    .split(' ')
    .filter(Boolean)
    .map(w => w[0].toUpperCase() + w.slice(1))
    .join(' ');
}

function pickKnownSupplier(text: string): string | null {
  const low = text.toLowerCase();
  const hit = KNOWN_SUPPLIERS.find(name => low.includes(name.toLowerCase()));
  return hit ? normalizeSupplierName(hit) : null;
}

// 1) Fallback: ta varumärke från tydlig e-post/domän (inte hopklistrat "info...brand")
function extractBrandFromDomains(text: string): string | null {
  const t = text.toLowerCase();
  const badEmailHosts = new Set(['gmail','hotmail','outlook','live','icloud','mail']);

  const mails = Array.from(
    t.matchAll(/\b[a-z0-9._%+-]+@([a-z0-9-]{3,})\.(se|com|nu|org|net|io|dev)\b/g)
  ).map(m => m[1]).filter(d => d && !badEmailHosts.has(d));

  const webs = Array.from(
    t.matchAll(/\b(?:www\.)?([a-z0-9-]{3,})\.(se|com|nu|org|net|io|dev)\b/g)
  ).map(m => m[1]);

  const pick = (d?: string) =>
    d ? d.replace(/-/g, ' ').split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : null;

  if (mails.length) return pick(mails[0]);
  if (webs.length >= 2) return pick(webs[0]); // kräver fler träffar för att vara säkert
  return null;
}

// 2) Ny gissning: poängsätt raderna i toppen (undvik siffror/adresser/kvitto-ord)
function guessSupplierFromTopLines(text: string): string | null {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const TOP_N = 18;
  const EMAIL_OR_WEB = /@|www\.|https?:\/\/|\.[a-z]{2,3}\b/i;
  const ADDRESS = /\b(gatan|gata|vägen|väg|torget|square|street|road|box)\b/i;
  const KILLWORDS = /(kvittokopia|kopia|kvitto|receipt|org\.?nr|orgnr|moms|vat|total|totalt|summa|att betala|belopp|datum|time|tid|butik|kassa|exped|faktura|kvittonr|terminal|kort|tack|välkommen|welcome|kundservice|kundtjänst|kontakt|support)/i;

  type Cand = { line: string; score: number };
  const cands: Cand[] = [];

  for (let i = 0; i < Math.min(lines.length, TOP_N); i++) {
    const l = lines[i];
    if (!l || l.length < 3) continue;

    let score = 0;
    const wordCount = l.split(/\s+/).length;
    const hasDigits = /\d/.test(l);
    const isAllCaps = /^[A-ZÅÄÖ&.\- ]{3,}$/.test(l) && !/[a-zåäö]/.test(l);
    const hasCorp = /\b(AB|HB|KB)\b/i.test(l);

    score += Math.max(0, 12 - i); // nära toppen = bättre
    if (isAllCaps) score += 4;
    if (hasCorp) score += 3;
    if (hasDigits) score -= 4;
    if (EMAIL_OR_WEB.test(l)) score -= 6;
    if (ADDRESS.test(l)) score -= 6;
    if (KILLWORDS.test(l)) score -= 8;
    if (wordCount > 5 || l.length > 32) score -= 3;

    cands.push({ line: l, score });
  }

  cands.sort((a, b) => b.score - a.score);
  const best = cands.find(c => c.score >= 4);
  return best ? normalizeSupplierName(best.line) : null;
}

// 3) Postprocess: rensa skräp; använd domän endast om ingen vettig kandidat hittas
function postprocessSupplier(cand: string | null, allText: string): string | null {
  const clean = (s: string) => {
    let out = s;
    out = out.replace(/^([A-Za-zÅÄÖåäö])\1\s+/, ''); // "Yy Garn..." -> "Garn..."
    out = out.replace(/\b(Får|Välkommen|Tack|Kvitto|Receipt)\b/gi, ' ');
    out = out.replace(/\s{2,}/g, ' ').trim();
    return normalizeSupplierName(out);
  };

  if (cand && !/@|\b\w+\.(se|com|nu|org|net|io|dev)\b/i.test(cand)) {
    const cc = clean(cand);
    if (cc && cc.length >= 3) return cc;
  }

  const brand = extractBrandFromDomains(allText);
  return brand ? normalizeSupplierName(brand) : (cand ? clean(cand) : null);
}

/** Plocka ut belopp/moms från texten */
function parseAmounts(text: string): { amountIncl?: number; vatAmount?: number } {
  const lines = text.split(/\r?\n/).map(s => s.trim()).filter(Boolean);

  for (const l of lines) {
    if (/(moms|vat)/i.test(l)) {
      const m = l.match(/(-?\d[\d .]*[.,]\d{1,2})\s*(kr)?$/i) || l.match(/(-?\d[\d .]*)\s*(kr)?$/i);
      if (m) {
        const v = parseNumber(m[1]);
        if (v != null) {
          return { vatAmount: v };
        }
      }
    }
  }

  let candTotals: number[] = [];
  for (let i=0;i<lines.length;i++){
    const l = lines[i];
    if (/(att betala|summa|total|totalt|belopp|slutsumma)/i.test(l)) {
      const m = l.match(/(-?\d[\d .]*[.,]\d{1,2})/);
      if (m) {
        const v = parseNumber(m[1]);
        if (v != null) candTotals.push(v);
      } else {
        const n = lines[i+1];
        const m2 = n?.match(/(-?\d[\d .]*[.,]\d{1,2})/);
        if (m2) {
          const v2 = parseNumber(m2[1]);
          if (v2 != null) candTotals.push(v2);
        }
      }
    }
  }

  if (candTotals.length === 0) {
    const any = Array.from(text.matchAll(/-?\d[\d .]*[.,]\d{1,2}/g))
      .map(m => parseNumber(m[0]))
      .filter((n): n is number => n != null);
    if (any.length) candTotals.push(any.sort((a,b)=>b-a)[0]);
  }

  const amountIncl = candTotals[0];

  let vatAmount: number | undefined = undefined;
  if (/(25\s*%)/.test(text) && amountIncl != null) {
    vatAmount = Math.round((amountIncl * 0.2) * 100) / 100;
  }

  return { amountIncl, vatAmount };
}

/** OCR borttagen: Placeholder som returnerar tom text tills eventuell ersättning (t.ex. GPT) */
async function ocrAllTextFromBlob(_blob: Blob): Promise<string> {
  // TODO: Här fanns OCR. Ersätt med ny strategi vid behov.
  return '';
}

/** Huvud: OCR → tolka → skriv in i state */
async function readAndAutofillFromBlob(
  blob: Blob,
  setters: {
    setSupplierName: (s: string)=>void;
    setAmount: (s: string)=>void;
    setVat: (s: string)=>void;
    setDate: (s: string)=>void;
  }
) {
  const allText = await ocrAllTextFromBlob(blob);

  let supplier =
    pickKnownSupplier(allText) ||
    guessSupplierFromTopLines(allText) ||
    null;
  supplier = postprocessSupplier(supplier, allText) || supplier || 'Okänd';

  const parsedDate = parseDateFromText(allText);
  const { amountIncl, vatAmount } = parseAmounts(allText);

  if (supplier && supplier !== 'Okänd') setters.setSupplierName(supplier);
  if (amountIncl != null) setters.setAmount(String(amountIncl));
  if (vatAmount != null) setters.setVat(String(vatAmount));
  if (parsedDate) setters.setDate(parsedDate);
}

// =========================
// Huvudkomponent
// =========================

export default function DashboardPage() {
  // AUTH-GUARD utan router (krockar inte)
useEffect(() => {
  if (AUTH_DISABLED) return; // hoppa över inloggning i dev/om flagg satt
  let active = true;
  supabase.auth.getSession().then(({ data }) => {
    if (active && !data.session) {
      // Använd fönstrets navigering istället för useRouter
      window.location.assign("/login");
    }
  });
  return () => { active = false; };
}, []);

  const router = useRouter();

  const [isClient, setIsClient] = useState(false);
  useEffect(() => setIsClient(true), []);
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    if (typeof navigator !== 'undefined') {
      const ua = navigator.userAgent || navigator.vendor || (window as any).opera || '';
      setIsMobile(/android|iphone|ipad|ipod|mobile/i.test(ua));
    }
  }, []);

  const [customers, setCustomers] = useState<Kund[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  const [entries, setEntries] = useState<BookkeepEntry[]>([]);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const objectUrlsRef = useRef<string[]>([]);

  // Filter (månad)
  const [selectedMonth, setSelectedMonth] = useState<string>("all");

  const monthOptions = useMemo(() => {
    const set = new Set<string>();
    for (const e of entries) {
      if (!e.invoiceDate) continue;
      const m = e.invoiceDate.slice(0, 7); // YYYY-MM
      if (m) set.add(m);
    }
    return Array.from(set).sort().reverse();
  }, [entries]);

  const displayedEntries = useMemo(() => {
    if (selectedMonth === "all") return entries;
    return entries.filter(e => (e.invoiceDate || "").startsWith(selectedMonth));
  }, [entries, selectedMonth]);

  const [supplierName, setSupplierName] = useState('');
  const [amount, setAmount] = useState<string>('');
  const [vat, setVat] = useState<string>('');
  const [date, setDate] = useState<string>('');
  const [pendingBlob, setPendingBlob] = useState<Blob | undefined>(undefined);
  const [pendingMime, setPendingMime] = useState<string | undefined>(undefined);

  const cameraRef = useRef<HTMLInputElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [ocrRunning, setOcrRunning] = useState(false);
  const [batchOcrRunning, setBatchOcrRunning] = useState(false);
  const [qualityError, setQualityError] = useState<string>('');

  useEffect(() => {
    if (isClient) setDate(new Date().toISOString().slice(0, 10));
  }, [isClient]);

  useEffect(() => {
    if (!isClient) return;
    laddaKunder();
    loadEntries();
    const onStorage = () => { laddaKunder(); loadEntries(); };
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('storage', onStorage);
      objectUrlsRef.current.forEach(u => URL.revokeObjectURL(u));
      objectUrlsRef.current = [];
    };
  }, [isClient]);

  useEffect(() => {
    if (!isClient) return;
    (async () => {
      const map: Record<string, string> = {};
      objectUrlsRef.current.forEach(u => URL.revokeObjectURL(u));
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
  }, [entries, isClient]);

  useEffect(() => {
    if (!isClient) return;
    if (batchOcrRunning) return;
    // OCR borttagen: hoppa över automatisk leverantörsupplockning från bilder
    return;
  }, [entries, isClient, batchOcrRunning]);

  useEffect(() => {
    // draw mini chart after render when entries change
    const canvas = document.getElementById('bk-mini-chart') as HTMLCanvasElement | null;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // build monthly sums for current year
    const map: Record<string, number> = {};
    for (const e of displayedEntries) {
      const ym = (e.invoiceDate || '').slice(0,7);
      if (!ym) continue;
      map[ym] = (map[ym] || 0) + (e.amountInclVat || 0);
    }
    const labels = Object.keys(map).sort();
    const values = labels.map(k => map[k]);

    const width = (labels.length || 6) * 56; // dynamic width
    const height = 120;
    canvas.width = Math.max(width, 360);
    canvas.height = height;

    ctx.clearRect(0,0,canvas.width, canvas.height);
    const max = Math.max(1, ...values);
    const padL = 32, padB = 18, barW = 32, gap = 24;
    labels.forEach((lab, i) => {
      const x = padL + i * (barW + gap);
      const h = Math.round(((values[i] || 0) / max) * (height - padB - 12));
      const y = height - padB - h;
      ctx.fillStyle = '#111827'; // gray-900
      ctx.fillRect(x, y, barW, h);
      ctx.fillStyle = '#6b7280'; // gray-500
      ctx.font = '10px sans-serif';
      ctx.fillText(lab.slice(2), x-2, height - 6);
    });
  }, [displayedEntries]);

const laddaKunder = async () => {
  // 1) Gamla lokala kunder från localStorage (Test ab m.fl.)
  const keys = Object.keys(localStorage).filter((k) => /^kund_\d+$/.test(k));
  const list: Kund[] = [];

  for (const key of keys) {
    const raw = localStorage.getItem(key);
    if (!raw) continue;
    try {
      const parsed: any = JSON.parse(raw) || {};
      const rawId = key.split('_')[1]; // t.ex. "123" i "kund_123"
      const id = parsed.id ? String(parsed.id) : String(rawId);

      if (!id) continue;

      const companyName = (parsed.companyName || '').trim();
      const hasOffert = !!localStorage.getItem(`kund_offert_${id}`) || !!localStorage.getItem(`sent_offer_${id}`);
      const hasOrder = !!localStorage.getItem(`kund_order_${id}`) || !!localStorage.getItem(`sent_order_${id}`);
      const hasInvoice = !!localStorage.getItem(`kund_invoice_${id}`) || !!localStorage.getItem(`sent_invoice_${id}`);
      const isEmpty = !companyName && !hasOffert && !hasOrder && !hasInvoice;

      if (!isEmpty && !DEMO_CUSTOMERS.has(companyName)) {
        list.push({
          id,
          companyName: companyName || 'Namnlös kund',
          orgNr: parsed.orgNr || '',
          contactPerson: parsed.contactPerson || '',
          role: parsed.role || '',
          phone: parsed.phone || '',
          email: parsed.email || '',
          address: parsed.address || '',
          zip: parsed.zip || '',
          city: parsed.city || '',
          country: parsed.country || 'Sverige',
          contactDate: parsed.contactDate || '',
          notes: parsed.notes || '',
          customerNumber: parsed.customerNumber || '',
        });
      }
    } catch {
      // Ignorera trasig localStorage-rad
    }
  }

  const localUnique = Array.from(new Map(list.map((c) => [c.id, c])).values());

  // 2) Nya kunder från Supabase (tabellen "customers")
  try {
    const { data, error } = await supabase
      .from('customers')
      .select('id, name, orgnr, email, phone, address, zip, city, country');

    if (error) {
      console.error('Kunde inte hämta customers från Supabase:', error.message);
      setCustomers(localUnique);
      return;
    }

    const dbCustomers: Kund[] = (data || []).map((row: any) => ({
      id: String(row.id),
      companyName: (row.name || '').trim() || 'Namnlös kund',
      orgNr: row.orgnr || '',
      contactPerson: '',
      role: '',
      phone: row.phone || '',
      email: row.email || '',
      address: row.address || '',
      zip: row.zip || '',
      city: row.city || '',
      country: row.country || 'Sverige',
      contactDate: '',
      notes: '',
      customerNumber: '',
    }));

   const all = [...localUnique, ...dbCustomers];

// NYTT: filtrera bort demo-kunder även från Supabase-listan
const allFiltered = all.filter(c => !DEMO_CUSTOMERS.has(c.companyName));

const uniqueAll = Array.from(new Map(allFiltered.map((c) => [c.id, c])).values());
setCustomers(uniqueAll);

  } catch (e) {
    console.error('Fel vid laddaKunder:', e);
    setCustomers(localUnique);
  }
};

  function loadEntries() {
    try {
      const raw = localStorage.getItem(BK_KEY);
      setEntries(raw ? JSON.parse(raw) : []);
    } catch { setEntries([]); }
  }
  function saveEntries(next: BookkeepEntry[]) {
    localStorage.setItem(BK_KEY, JSON.stringify(next));
    setEntries(next);
  }

  function exportCsv(list: BookkeepEntry[]) {
    const rows = [
      ["Typ","Datum","Kund/Leverantör","Nummer","Belopp inkl","Moms","Status"],
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

  const totals = useMemo(() => {
    const income = entries.filter(e => e.type === 'invoice');
    const expense = entries.filter(e => e.type === 'expense');
    const incomeSum = income.reduce((s, x) => s + (x.amountInclVat || 0), 0);
    const expenseSum = expense.reduce((s, x) => s + (x.amountInclVat || 0), 0);
    const outVat = income.reduce((s, x) => s + (x.vatAmount || 0), 0);
    const inVat = expense.reduce((s, x) => s + (x.vatAmount || 0), 0);
    return { incomeSum, expenseSum, result: incomeSum - expenseSum, vatToPay: outVat - inVat };
  }, [entries]);

  const filteredSums = useMemo(() => {
    const list = displayedEntries;
    const sumIncl = list.reduce((s,x)=> s + (x.amountInclVat || 0), 0);
    const sumVat = list.reduce((s,x)=> s + (x.vatAmount || 0), 0);
    return { sumIncl, sumVat, count: list.length };
  }, [displayedEntries]);

  // ===== Uppladdning + automatisk OCR =====
  async function onPickCamera(e: React.ChangeEvent<HTMLInputElement>) {
    const inputEl = cameraRef.current;
    const f = e.currentTarget.files?.[0];
    if (!f) { if (inputEl) inputEl.value = ''; return; }
    
    setQualityError(''); // Rensa tidigare fel
    
    try {
      const blob = await compressImageToBlob(f);
      setPendingBlob(blob);
      setPendingMime('image/jpeg');
      // OCR borttagen: inget autofyll från bild
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Kunde inte läsa bilden.';
      setQualityError(errorMessage);
    }
    finally { if (inputEl) inputEl.value = ''; setOcrRunning(false); }
  }

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const inputEl = fileRef.current;
    const f = e.currentTarget.files?.[0];
    if (!f) { if (inputEl) inputEl.value = ''; return; }
    
    setQualityError(''); // Rensa tidigare fel
    
    try {
      if (f.type.startsWith('image/')) {
        const blob = await compressImageToBlob(f);
        setPendingBlob(blob); setPendingMime('image/jpeg');
        // OCR borttagen: ingen autofyll
      } else {
        const buf = await f.arrayBuffer();
        const blob = new Blob([buf], { type: f.type || 'application/pdf' });
        setPendingBlob(blob);
        setPendingMime(f.type || 'application/pdf');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Kunde inte läsa filen.';
      setQualityError(errorMessage);
    }
    finally { if (inputEl) inputEl.value = ''; setOcrRunning(false); }
  }

  async function addExpense(status: Status) {
    const amountNum = Number(amount || 0);
    const vatNum = Number(vat || 0);
    if (Number.isNaN(amountNum) || Number.isNaN(vatNum)) { alert('Belopp/Moms är ogiltigt.'); return; }
    if (ocrRunning) { alert('Vänta – läser kvittot…'); return; }

    const entryId = Date.now().toString();
    const newEntry: BookkeepEntry = {
      id: entryId,
      type: 'expense',
      supplierName: supplierName || 'Okänd',
      invoiceDate: date || new Date().toISOString().slice(0, 10),
      amountInclVat: amountNum,
      vatAmount: vatNum,
      status,
    };

    if (pendingBlob && pendingMime) {
      const fileKey = `bk_${entryId}`;
      try {
        // 1) Lokalt (IndexedDB) för snabb åtkomst på denna enhet
        await idbSet(fileKey, pendingBlob);
        newEntry.fileKey = fileKey;
        newEntry.fileMime = pendingMime;
        // 2) Moln (Supabase Storage) för andra enheter
        const ext = pendingMime.startsWith('image/') ? 'jpg' : (pendingMime.split('/')[1] || 'bin');
        const path = `attachments/${entryId}.${ext}`;
        const url = await uploadPublicBlob(path, pendingBlob, pendingMime);
        if (url) {
          // Spara publik URL i entry för cross-device visning
          (newEntry as any).publicUrl = url as string;
        }
      } catch { alert('Kunde inte spara bilagan.'); }
    }

    saveEntries([newEntry, ...entries]);
    setSupplierName(''); setAmount(''); setVat('');
    setDate(new Date().toISOString().slice(0, 10));
    setPendingBlob(undefined); setPendingMime(undefined);
  }

  async function deleteEntry(id: string) {
    const target = entries.find(e => e.id === id);
    saveEntries(entries.filter(e => e.id !== id));
    if (target?.fileKey) { try { await idbDel(target.fileKey); } catch {} }
  }

  const skapaNyKund = () => router.push(`/kund/${Date.now()}`);
  const taBortKund = (id: string) => {
    if (!confirm('Är du säker på att du vill ta bort kunden?')) return;
    localStorage.removeItem(`kund_${id}`);
    localStorage.removeItem(`kund_files_${id}`);
    localStorage.removeItem(`kund_images_${id}`);
    localStorage.removeItem(`kund_offert_${id}`);
    localStorage.removeItem(`kund_order_${id}`);
    localStorage.removeItem(`kund_invoice_${id}`);
    localStorage.removeItem(`sent_offer_${id}`);
    localStorage.removeItem(`sent_order_${id}`);
    localStorage.removeItem(`sent_invoice_${id}`);
    setCustomers(prev => prev.filter(k => k.id !== id));
  };

  const getStatus = (key: string) => {
    const d = localStorage.getItem(key);
    return d ? (
      <div className="flex flex-col items-center text-green-600 text-sm">
        ✅<span className="text-gray-600 text-xs">{d}</span>
      </div>
    ) : (<span className="text-red-600 text-lg">❌</span>);
  };

  const filtreradeKunder = customers.filter(k =>
    (k.companyName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (k.customerNumber || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!isClient) {
    return <div className="p-6 text-gray-500">Laddar…</div>;
  }

  return (
    <div className="px-3 sm:px-6 md:px-8 py-6 space-y-10 max-w-screen-sm mx-auto md:max-w-6xl md:mx-auto">
      <LogoutButton />
      {/* Tillbaka till Start-knapp */}
      <div className="flex justify-start">
        <Link
          href="/start"
          className="bg-green-600 text-white px-4 py-2 rounded text-sm hover:bg-green-700 transition-colors"
        >
          🏠 Tillbaka till Start
        </Link>
      </div>
      
      <DashboardCounter />
      {/* Kundregister */}
      <div>
        <div className="mb-2">
          <h1 className="text-2xl font-bold">Kundregister</h1>
        </div>
        {/* Flytande "Nästa" uppe till höger, matchar tillbaka-knappens stil */}
        

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-3">
          <div className="flex gap-2">
            <button
              onClick={skapaNyKund}
              className="w-full sm:w-auto bg-green-600 text-white px-5 py-3 md:px-4 md:py-2 text-base md:text-sm rounded-lg hover:bg-green-700"
            >
              + Lägg till kund
            </button>
          </div>
          <input
            type="text"
            placeholder="Sök kundnamn eller nummer..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="border border-gray-300 rounded-lg px-4 py-3 md:px-3 md:py-2 w-full sm:w-64 text-base md:text-sm"
          />
        </div>

        {/* Bildkvalitetsfel */}
        {qualityError && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">
                  Bildkvalitet otillräcklig
                </h3>
                <div className="mt-2 text-sm text-red-700">
                  <p>{qualityError}</p>
                </div>
                <div className="mt-3">
                  <button
                    onClick={() => setQualityError('')}
                    className="text-sm bg-red-100 text-red-800 px-3 py-1 rounded hover:bg-red-200"
                  >
                    Stäng
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="overflow-x-auto rounded border">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-100 text-left">
                <th className="border px-4 py-3">Kundnamn</th>
                <th className="border px-4 py-3">Kundnummer</th>
                <th className="border px-4 py-3 text-center">Offert</th>
                <th className="border px-4 py-3 text-center">Order</th>
                <th className="border px-4 py-3 text-center">Faktura</th>
                <th className="border px-4 py-3 text-center">Redigera</th>
                <th className="border px-4 py-3 text-center">🗑️</th>
              </tr>
            </thead>
            <tbody>
              {filtreradeKunder.length > 0 ? (
                filtreradeKunder.map((kund, i) => (
                  <tr key={kund.id || `${kund.customerNumber}-${i}`} className="align-middle">
                    <td className="border px-4 py-3">{kund.companyName || 'Namnlös kund'}</td>
                    <td className="border px-4 py-3">{kund.customerNumber}</td>
                    <td className="border px-4 py-3 text-center">{getStatus(`sent_offer_${kund.id}`)}</td>
                    <td className="border px-4 py-3 text-center">{getStatus(`sent_order_${kund.id}`)}</td>
                    <td className="border px-4 py-3 text-center">{getStatus(`sent_invoice_${kund.id}`)}</td>
                    <td className="border px-4 py-3 text-center">
                      <Link href={`/kund/${kund.id}`} className="text-blue-600 hover:underline">Redigera</Link>
                    </td>
                    <td className="border px-4 py-3 text-center">
                      <button onClick={() => taBortKund(kund.id)} className="text-red-600 hover:underline">🗑️</button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={7} className="text-center py-4 text-gray-500">Ingen kund hittades.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bokföring */}
      <div className="mt-8 flex justify-center">
        <Link
          href="/dashboard/bookkeepingboard"
          className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
        >
          Öppna bokföring →
        </Link>
      </div>
    </div>
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

function formatCurrency(n: number) {
  return new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK', maximumFractionDigits: 0 }).format(n || 0);
}
