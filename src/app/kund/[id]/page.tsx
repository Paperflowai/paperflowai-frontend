// src/app/kund/[id]/page.tsx
"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import SavingsBadge from "@/components/SavingsBadge";

type DocFile = { name: string; url: string };
type BkFile = { name: string; url: string; type: "image" | "pdf" };

declare global {
  interface Window {
    pdfjsLib?: any;
  }
}

/* ============================
   IndexedDB för PDF:er
   ============================ */
const DB_NAME = "paperflow-docs";
const STORE = "files";

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
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(blob, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
async function idbGet(key: string): Promise<Blob | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(key);
    req.onsuccess = () => resolve(req.result as Blob | undefined);
    req.onerror = () => reject(req.error);
  });
}
async function idbDel(key: string) {
  const db = await openDB();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/* ============================
   Komponent
   ============================ */
export default function KundDetaljsida() {
  const params = useParams();
  const raw = Array.isArray((params as any).id) ? (params as any).id[0] : (params as any).id;
  const parsed = Number(raw);
  const id = Number.isFinite(parsed) && parsed > 0 ? parsed : 1;

  const [data, setData] = useState({
    companyName: "",
    orgNr: "",
    contactPerson: "",
    role: "",
    phone: "",
    email: "",
    address: "",
    zip: "",
    city: "",
    country: "Sverige",
    contactDate: "",
    notes: "",
    customerNumber: ""
  });

  const [images, setImages] = useState<{ name: string; url: string }[]>([]);
  const [offert, setOffert] = useState<DocFile | null>(null);
  const [order, setOrder] = useState<DocFile | null>(null);
  const [invoice, setInvoice] = useState<DocFile | null>(null);
  const [sentStatus, setSentStatus] = useState<{ [key: string]: string }>({
    offert: "",
    order: "",
    invoice: ""
  });

  // 📚 Bokföringsfiler (visning)
  const [bookkeepingFiles, setBookkeepingFiles] = useState<BkFile[]>([]);
  // 📚 Bokföringsposter (formulär -> lista)
  type Expense = {
    supplier: string;
    amountIncl: number;
    vat: number;
    date: string;
    fileName?: string;
    fileType?: "image" | "pdf";
    fileDataUrl?: string; // för snabb visning
    draft?: boolean;
  };
  const [expenses, setExpenses] = useState<Expense[]>([]);

  // Formulärstate för “+ Lägg till kvitto/utgift”
  const [supplier, setSupplier] = useState("");
  const [amountIncl, setAmountIncl] = useState<string>("");
  const [vat, setVat] = useState<string>("");
  const [date, setDate] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<{ name: string; dataUrl: string; type: "image" | "pdf" } | null>(null);

  // Blob-URL:er att städa bort
  const objectUrlsRef = useRef<string[]>([]);

  /* ===== Init ===== */
  useEffect(() => {
    // Sätt dagens datum när komponenten mountar
    setDate(new Date().toISOString().slice(0, 10));
    
    const saved = localStorage.getItem(`kund_${id}`);
    if (saved) {
      setData(JSON.parse(saved));
    } else {
      const nyttKundnummer = `K-${Math.floor(100000 + Math.random() * 900000)}`;
      const initialData = { ...data, customerNumber: nyttKundnummer };
      localStorage.setItem(`kund_${id}`, JSON.stringify(initialData));
      setData(initialData);
    }

    const savedImages = localStorage.getItem(`kund_images_${id}`);
    if (savedImages) setImages(JSON.parse(savedImages));

    const savedOffertMeta = localStorage.getItem(`kund_offert_${id}`);
    const savedOrderMeta = localStorage.getItem(`kund_order_${id}`);
    const savedInvoiceMeta = localStorage.getItem(`kund_invoice_${id}`);

    async function restoreDoc(type: "offert" | "order" | "invoice", metaStr: string | null) {
      const key = `${type}_${id}`;
      const blob = await idbGet(key);
      if (blob) {
        const name = metaStr ? (JSON.parse(metaStr).name as string) : `${type}.pdf`;
        const url = URL.createObjectURL(blob);
        objectUrlsRef.current.push(url);
        const f = { name, url };
        if (type === "offert") setOffert(f);
        if (type === "order") setOrder(f);
        if (type === "invoice") setInvoice(f);
      }
    }

    Promise.resolve()
      .then(() => restoreDoc("offert", savedOffertMeta))
      .then(() => restoreDoc("order", savedOrderMeta))
      .then(() => restoreDoc("invoice", savedInvoiceMeta))
      .catch(() => {});

    const savedStatus = localStorage.getItem(`kund_sent_${id}`);
    if (savedStatus) setSentStatus(JSON.parse(savedStatus));

    const savedBk = localStorage.getItem(`kund_bookkeeping_${id}`);
    if (savedBk) setBookkeepingFiles(JSON.parse(savedBk));

    const savedExpenses = localStorage.getItem(`kund_expenses_${id}`);
    if (savedExpenses) setExpenses(JSON.parse(savedExpenses));

    return () => {
      objectUrlsRef.current.forEach((u) => URL.revokeObjectURL(u));
      objectUrlsRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function persistData(updated: typeof data) {
    localStorage.setItem(`kund_${id}`, JSON.stringify(updated));
    setData(updated);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value } = e.target;
    const updated = { ...data, [name]: value };
    persistData(updated);
  }

  /* ===== Bilder (kladdlappar) ===== */
  function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const uploaded = e.target.files;
    if (!uploaded) return;

    Array.from(uploaded).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const newImage = { name: file.name, url: result };
        setImages((prev) => {
          const updated = [...prev, newImage];
          localStorage.setItem(`kund_images_${id}`, JSON.stringify(updated));
          return updated;
        });
      };
      reader.readAsDataURL(file);
    });
  }
  function deleteImage(index: number) {
    setImages((prev) => {
      const updated = [...prev.slice(0, index), ...prev.slice(index + 1)];
      localStorage.setItem(`kund_images_${id}`, JSON.stringify(updated));
      return updated;
    });
  }

  /* ===== PDF.js & parser för Offert-autofyll (oförändrat) ===== */
  async function loadPdfJsOnce(): Promise<any> {
    if (window.pdfjsLib) return window.pdfjsLib;
    await new Promise<void>((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error("Kunde inte ladda PDF.js"));
      document.head.appendChild(s);
    });
    const pdfjsLib = window.pdfjsLib!;
    try {
      pdfjsLib.GlobalWorkerOptions.workerSrc =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
    } catch {}
    return pdfjsLib;
  }
  async function extractTextFromPDF(file: File): Promise<string> {
    try {
      const pdfjsLib = await loadPdfJsOnce();
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let fullText = "";
      for (let p = 1; p <= pdf.numPages; p++) {
        const page = await pdf.getPage(p);
        const content = await page.getTextContent();
        const strings = content.items.map((it: any) => it.str);
        fullText += strings.join("\n") + "\n";
      }
      return fullText;
    } catch {
      return "";
    }
  }
  function normalize(s: string) {
    return s.replace(/\u2011|\u2013|\u2014/g, "-").replace(/\u00A0/g, " ").replace(/[^\S\r\n]+/g, " ");
  }
  function formatZip(zip: string) {
    const only = (zip || "").replace(/\D/g, "");
    if (only.length === 5) return `${only.slice(0, 3)} ${only.slice(3)}`;
    return (zip || "").trim();
  }
  function parseFieldsFromText(txt: string, filename?: string) {
    try {
      const norm = normalize(txt || "");
      const safeGet = (re: RegExp) => {
        const m = norm.match(re);
        return (m && m[1] ? String(m[1]).trim() : "");
      };
      const kund = safeGet(/(?:Kund|Beställare|Företag|Kundnamn)\s*:?\s*(.+)/i);
      const datum = safeGet(/(?:Datum|Offertdatum)\s*:?\s*([0-9]{4}-[0-9]{2}-[0-9]{2}|[0-9]{2}[-/.][0-9]{2}[-/.][0-9]{2,4})/i);
      let offertnr = safeGet(/(?:Offert(?:nummer|\s*nr\.?)?|Offert-Nr\.?)\s*:?\s*([A-Za-z0-9\-_/]+)/i);
      const orgnr =
        safeGet(/(?:Org(?:\.|\s)?(?:nr|nummer)|Organisations(?:nummer|nr))\s*:?\s*([0-9\- ]{6,})/i) ||
        safeGet(/(?:VAT|Momsregnr|VAT(?:\s*nr)?)\s*:?\s*([A-Za-z0-9\- ]{6,})/i);

      let adress = safeGet(/(?:Adress|Gatuadress|Besöksadress)\s*:?\s*(.+)/i) || safeGet(/(?:Postadress)\s*:?\s*(.+)/i);
      const postrad =
        (norm.match(/(?:Postnr(?:\.|)|Postnummer|Postadress)\s*:?\s*([0-9]{3}\s?[0-9]{2}\s+[^\n]+)/i)?.[1]) ||
        (norm.match(/([0-9]{3}\s?[0-9]{2})\s+([A-Za-zÅÄÖåäö\- ]{2,})/)?.[0]) ||
        "";

      const telefon = safeGet(/(?:Telefon|Tel\.?|Tel)\s*:?\s*([\d +\-()]{5,})/i);
      const email = safeGet(/(?:E-?post|E ?post|E-mail|Mail)\s*:?\s*([^\s,;<>]+@[^\s,;<>]+)/i);
      const kontaktperson = safeGet(/(?:Kontaktperson|Kontakt)\s*:?\s*([^\n]+)/i);
      const land = safeGet(/(?:Land|Country)\s*:?\s*([^\n]+)/i);

      let street = adress || "", zip = "", city = "";
      if (adress) {
        const parts = adress.split(",").map(s => s.trim()).filter(Boolean);
        if (parts.length >= 2) {
          street = parts[0];
          const tail = parts.slice(1).join(", ");
          const m = tail.match(/(\d{3}\s?\d{2})\s+(.+)/);
          if (m?.[1] && m?.[2]) { zip = formatZip(m[1]); city = String(m[2]).trim(); }
          else if (!city) city = tail;
        }
      }
      if ((!zip || !city) && postrad) {
        const m2 = postrad.match(/(\d{3}\s?\d{2})\s+(.+)/);
        if (m2?.[1] && m2?.[2]) { zip = formatZip(m2[1]); city = String(m2[2]).trim(); }
      }

      let companyGuess = kund || "";
      if (!companyGuess) {
        const firstLines = norm.split("\n").slice(0, 12).map(s => s.trim()).filter(Boolean);
        const stopIdx = firstLines.findIndex(l => /offert|order|faktura/i.test(l));
        const scope = stopIdx > 0 ? firstLines.slice(0, stopIdx) : firstLines;
        const cand = scope.find(l => /[A-Za-zÅÄÖåäö]/.test(l) && l.split(" ").length >= 2 && l.length <= 60);
        if (cand) companyGuess = cand.replace(/^(AB|HB|KB)\s+/i, "").trim();
      }
      if (!offertnr && filename) {
        const m = filename.match(/(offert|offer|off)\s*[-_ ]?\s*([A-Za-z0-9\-_/]+)/i);
        if (m?.[2]) offertnr = m[2];
      }

      const mapped = {
        companyName: companyGuess || "",
        orgNr: orgnr || "",
        contactPerson: kontaktperson || "",
        phone: telefon || "",
        email: email || "",
        address: street || "",
        zip: zip ? formatZip(zip) : "",
        city: city || "",
        country: land || "Sverige",
        contactDate: datum || "",
        customerNumber: offertnr || "",
      } as Partial<typeof data>;

      return Object.fromEntries(Object.entries(mapped).map(([k, v]) => [k, (data as any)[k] || v])) as Partial<typeof data>;
    } catch {
      return {};
    }
  }

  /* ===== Offert/Order/Faktura uppladdning ===== */
  async function handleSpecialUpload(
    e: React.ChangeEvent<HTMLInputElement>,
    type: "offert" | "order" | "invoice"
  ) {
    const inputEl = e.currentTarget as HTMLInputElement;
    const uploaded = inputEl.files?.[0];
    if (!uploaded) { inputEl.value = ""; return; }

    try {
      const key = `${type}_${id}`;
      await idbSet(key, uploaded);

      const url = URL.createObjectURL(uploaded);
      objectUrlsRef.current.push(url);

      localStorage.setItem(`kund_${type}_${id}`, JSON.stringify({ name: uploaded.name }));
      const newFile = { name: uploaded.name, url };
      if (type === "offert") setOffert(newFile);
      if (type === "order") setOrder(newFile);
      if (type === "invoice") setInvoice(newFile);

      if (type === "offert") {
        const text = await extractTextFromPDF(uploaded);
        if (text?.trim()) {
          const mapped = parseFieldsFromText(text, uploaded.name);
          const updated = { ...data, ...mapped };
          localStorage.setItem(`kund_${id}`, JSON.stringify(updated));
          setData(updated);
        }
      }
    } finally {
      inputEl.value = "";
    }
  }

  async function removeDoc(type: "offert" | "order" | "invoice") {
    const key = `${type}_${id}`;
    await idbDel(key);
    localStorage.removeItem(`kund_${type}_${id}`);
    if (type === "offert") setOffert(null);
    if (type === "order") setOrder(null);
    if (type === "invoice") setInvoice(null);
  }

  function printPdf(pdfUrl: string) {
    const win = window.open();
    if (!win) return;
    win.document.write(`<iframe src="${pdfUrl}" frameborder="0" style="width:100%;height:100%;" allowfullscreen></iframe>`);
    win.document.close();
    win.focus();
    win.print();
  }

  async function skickaEpost(pdfUrl: string, typ: string) {
    if (!data.email?.trim()) { alert("Fyll i kundens e-postadress först."); return; }
    const subject = `Här kommer din ${typ} från ${data.companyName || "oss"}`;
    const text = `Hej ${data.contactPerson || "kund"},\n\nHär kommer din ${typ}.\n\nLänk: ${pdfUrl}`;
    await fetch("/api/sendEmail", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ to: data.email, subject, text }) });
    const now = new Date().toLocaleDateString("sv-SE", { year: "numeric", month: "2-digit", day: "2-digit" });
    const newStatus = { ...sentStatus, [typ]: now };
    setSentStatus(newStatus);
    localStorage.setItem(`kund_sent_${id}`, JSON.stringify(newStatus));
    alert(`${typ} skickad till ${data.email}`);
  }

  /* ===== Bokföringsformulär (ny design som din bild) ===== */
  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const type: "image" | "pdf" = f.type.startsWith("image/") ? "image" : "pdf";
      setSelectedFile({ name: f.name, dataUrl, type });
    };
    reader.readAsDataURL(f);
    e.currentTarget.value = "";
  }
  function autoVatFromAmount(nextAmountIncl: string) {
    setAmountIncl(nextAmountIncl);
    const n = Number(nextAmountIncl.replace(",", "."));
    if (Number.isFinite(n)) {
      const inkl = n;
      // svensk standardmoms 25% -> moms = inkl * 20/125
      const moms = Math.round((inkl * 20) / 125 * 100) / 100;
      setVat(moms.toString());
    }
  }
  function saveExpense(draft: boolean) {
    if (!supplier.trim() && !selectedFile) {
      alert("Fyll i leverantör eller lägg till en fil först."); return;
    }
    const entry: Expense = {
      supplier: supplier.trim(),
      amountIncl: Number(amountIncl.replace(",", ".")) || 0,
      vat: Number(vat.replace(",", ".")) || 0,
      date,
      fileName: selectedFile?.name,
      fileType: selectedFile?.type,
      fileDataUrl: selectedFile?.dataUrl,
      draft
    };
    const list = [...expenses, entry];
    setExpenses(list);
    localStorage.setItem(`kund_expenses_${id}`, JSON.stringify(list));

    // Lägg även till i “bookkeepingFiles”-visningen om fil finns
    if (selectedFile) {
      const add: BkFile = { name: selectedFile.name, url: selectedFile.dataUrl, type: selectedFile.type };
      const updated = [...bookkeepingFiles, add];
      setBookkeepingFiles(updated);
      localStorage.setItem(`kund_bookkeeping_${id}`, JSON.stringify(updated));
    }

    // Nollställ formuläret
    setSupplier("");
    setAmountIncl("");
    setVat("");
    setDate(new Date().toISOString().slice(0, 10));
    setSelectedFile(null);
  }

  function deleteBookkeeping(index: number) {
    setBookkeepingFiles((prev) => {
      const updated = [...prev.slice(0, index), ...prev.slice(index + 1)];
      localStorage.setItem(`kund_bookkeeping_${id}`, JSON.stringify(updated));
      return updated;
    });
  }

  return (
    <div className="min-h-screen bg-white p-4 sm:p-6 text-gray-800 max-w-4xl mx-auto">
      <div className="mb-6 flex items-center justify-between gap-3">
  <h1 className="text-3xl font-bold">Kundkort</h1>
  <Link href={`/dashboard/bookkeepingboard?kund=${id}`}>
    <button className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded">
      Bokföring
    </button>
  </Link>
</div>

      {/* === Kunduppgifter === */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        {[
          { id: "companyName", label: "Företagsnamn", value: data.companyName },
          { id: "customerNumber", label: "Kundnummer (från Offertnummer)", value: data.customerNumber },
          { id: "contactPerson", label: "Kontaktperson", value: data.contactPerson },
          { id: "email", label: "E-post", value: data.email },
          { id: "phone", label: "Telefon", value: data.phone },
          { id: "address", label: "Adress", value: data.address },
          { id: "zip", label: "Postnummer", value: data.zip },
          { id: "city", label: "Ort", value: data.city },
          { id: "orgNr", label: "Org.nr", value: data.orgNr },
        ].map((f) => (
          <div key={f.id} className="flex flex-col">
            <label htmlFor={f.id} className="text-sm text-gray-600 mb-1">{f.label}</label>
            <input id={f.id} name={f.id} value={(data as any)[f.id] ?? ""} onChange={handleChange} className="border p-2 rounded" />
          </div>
        ))}

        <div className="flex flex-col">
          <label htmlFor="contactDate" className="text-sm text-gray-600 mb-1">Datum</label>
          <input id="contactDate" name="contactDate" type="date" value={data.contactDate} onChange={handleChange} className="border p-2 rounded" />
        </div>
        <div className="flex flex-col">
          <label htmlFor="role" className="text-sm text-gray-600 mb-1">Befattning</label>
          <input id="role" name="role" value={data.role} onChange={handleChange} className="border p-2 rounded" />
        </div>
        <div className="flex flex-col">
          <label htmlFor="country" className="text-sm text-gray-600 mb-1">Land</label>
          <input id="country" name="country" value={data.country} onChange={handleChange} className="border p-2 rounded" />
        </div>
      </div>

      {/* === Bilder & kladdlappar (oförändrat) === */}
      <h2 className="text-xl font-bold mt-8">📷 Bilder och kladdlappar</h2>
      <input type="file" accept="image/*" multiple onChange={handleImageUpload} className="mt-2 mb-4 text-blue-700 font-semibold cursor-pointer" />
      <div className="grid grid-cols-2 gap-4 mb-6">
        {images.map((img, idx) => (
          <div key={idx} className="border p-2 rounded shadow relative">
            <img src={img.url} alt={img.name} className="w-full h-auto rounded" />
            <p className="text-xs mt-1 break-all">{img.name}</p>
            <button onClick={() => deleteImage(idx)} className="absolute top-1 right-1 text-red-600 text-sm font-bold bg-white px-2 py-0.5 rounded" title="Ta bort bild">🗑️</button>
          </div>
        ))}
      </div>

      {/* === GPT-dokument (oförändrat) === */}
      <h2 className="text-xl font-bold mt-8">GPT-genererade dokument</h2>

      {/* Offert */}
      <div className="mb-4">
        <p className="font-semibold">🧾 Offert (PDF):</p>
        <input type="file" accept="application/pdf" onChange={(e) => handleSpecialUpload(e, "offert")} className="text-blue-700 font-semibold cursor-pointer" />
        {offert && (
          <div className="mt-2 space-y-2">
            <div className="flex justify-between items-center gap-4">
              <p className="text-sm text-blue-600 break-all">📎 {offert.name}</p>
              <button onClick={async () => { await removeDoc("offert"); }} className="text-red-600 text-sm font-semibold hover:underline">🗑️ Ta bort</button>
            </div>
            <iframe src={offert.url} className="w-full h-64 border rounded" title="Offert PDF"></iframe>
            <div className="flex gap-2 mt-2">
              <button onClick={() => skickaEpost(offert.url, "offert")} className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700">📤 Skicka</button>
              <button onClick={() => printPdf(offert.url)} className="bg-gray-300 px-3 py-1 rounded hover:bg-gray-400">🖨️ Skriv ut</button>
              {sentStatus["offert"] && <p className="text-green-600 text-sm">✔️ Skickad {sentStatus["offert"]}</p>}
            </div>
          </div>
        )}
      </div>

      {/* Order */}
      <div className="mb-4">
        <p className="font-semibold">📑 Orderbekräftelse (PDF):</p>
        <input type="file" accept="application/pdf" onChange={(e) => handleSpecialUpload(e, "order")} className="text-blue-700 font-semibold cursor-pointer" />
        {order && (
          <div className="mt-2 space-y-2">
            <div className="flex justify-between items-center">
              <p className="text-sm text-blue-600 break-all">📎 {order.name}</p>
              <button onClick={async () => { await removeDoc("order"); }} className="text-red-600 text-sm font-semibold hover:underline">🗑️ Ta bort</button>
            </div>
            <iframe src={order.url} className="w-full h-64 border rounded" title="Order PDF"></iframe>
            <div className="flex gap-2 mt-2">
              <button onClick={() => skickaEpost(order.url, "order")} className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700">📤 Skicka</button>
              <button onClick={() => printPdf(order.url)} className="bg-gray-300 px-3 py-1 rounded hover:bg-gray-400">🖨️ Skriv ut</button>
              {sentStatus["order"] && <p className="text-green-600 text-sm">✔️ Skickad {sentStatus["order"]}</p>}
            </div>
          </div>
        )}
      </div>

      {/* Faktura */}
      <div className="mb-8">
        <p className="font-semibold">💰 Faktura (PDF):</p>
        <input type="file" accept="application/pdf" onChange={(e) => handleSpecialUpload(e, "invoice")} className="text-blue-700 font-semibold cursor-pointer" />
        {invoice && (
          <div className="mt-2 space-y-2">
            <div className="flex justify-between items-center">
              <p className="text-sm text-blue-600 break-all">📎 {invoice.name}</p>
              <button onClick={async () => { await removeDoc("invoice"); }} className="text-red-600 text-sm font-semibold hover:underline">🗑️ Ta bort</button>
            </div>
            <iframe src={invoice.url} className="w-full h-64 border rounded" title="Faktura PDF"></iframe>
            <div className="flex gap-2 mt-2">
              <button onClick={() => skickaEpost(invoice.url, "invoice")} className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700">📤 Skicka</button>
              <button onClick={() => printPdf(invoice.url)} className="bg-gray-300 px-3 py-1 rounded hover:bg-gray-400">🖨️ Skriv ut</button>
              {sentStatus["invoice"] && <p className="text-green-600 text-sm">✔️ Skickad {sentStatus["invoice"]}</p>}
            </div>
          </div>
        )}
      </div>

      {/* =============================
          📚 BOKFÖRING – NYTTO-FORMULÄR
          ============================= */}
      <div className="border rounded-2xl p-4 sm:p-5 shadow-sm mb-4">
        <button
          type="button"
          className="w-full text-left text-lg font-semibold"
          // (Vill du ha öppna/stänga-funktion kan vi lägga till state; nu alltid öppet)
        >
          + Lägg till kvitto/utgift
        </button>

        <div className="mt-4 space-y-3">
          {/* Leverantör */}
          <div className="flex flex-col">
            <label className="text-sm text-gray-600 mb-1">Leverantör</label>
            <input
              className="border rounded-lg p-3"
              placeholder="t.ex. Byggmax"
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
            />
          </div>

          {/* Belopp & Moms */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col">
              <label className="text-sm text-gray-600 mb-1">Belopp (inkl. moms)</label>
              <input
                inputMode="decimal"
                className="border rounded-lg p-3"
                placeholder="0"
                value={amountIncl}
                onChange={(e) => autoVatFromAmount(e.target.value)}
              />
            </div>
            <div className="flex flex-col">
              <label className="text-sm text-gray-600 mb-1">Moms</label>
              <input
                inputMode="decimal"
                className="border rounded-lg p-3"
                placeholder="0"
                value={vat}
                onChange={(e) => setVat(e.target.value)}
              />
            </div>
          </div>

          {/* Datum */}
          <div className="flex flex-col">
            <label className="text-sm text-gray-600 mb-1">Datum</label>
            <input
              type="date"
              className="border rounded-lg p-3"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          {/* Fota kvitto / Välj fil */}
          <div className="space-y-3">
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={onPickFile}
            />
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              className="w-full bg-green-600 text-white font-semibold rounded-lg py-3"
            >
              📷 Fota kvitto
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={onPickFile}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full bg-indigo-600 text-white font-semibold rounded-lg py-3"
            >
              📄 Välj fil
            </button>

            {selectedFile && (
              <p className="text-xs text-gray-600 break-all">Vald fil: {selectedFile.name}</p>
            )}
          </div>

          {/* Spara-knappar */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              type="button"
              onClick={() => saveExpense(false)}
              className="bg-green-700 text-white rounded-lg py-3 font-semibold disabled:opacity-50"
              disabled={!selectedFile && !supplier && !amountIncl}
            >
              Spara & bokför
            </button>
            <button
              type="button"
              onClick={() => saveExpense(true)}
              className="border rounded-lg py-3 font-semibold"
            >
              Spara som utkast
            </button>
          </div>
        </div>
      </div>

      {/* Lista över bokföringsfiler (visuellt, som innan) */}
      {bookkeepingFiles.length === 0 && (
        <p className="text-gray-600 text-sm mb-4">Ingen bokföring registrerad ännu.</p>
      )}
      <div className="grid grid-cols-2 gap-4 mb-6">
        {bookkeepingFiles.map((f, idx) => (
          <div key={idx} className="border p-2 rounded shadow relative">
            {f.type === "image" ? (
              <img src={f.url} alt={f.name} className="w-full h-auto rounded" />
            ) : (
              <iframe src={f.url} className="w-full h-40 border rounded" title={`Bokföring ${f.name}`}></iframe>
            )}
            <p className="text-xs mt-1 break-all">{f.name}</p>
            <button
              onClick={() => deleteBookkeeping(idx)}
              className="absolute top-1 right-1 text-red-600 text-sm font-bold bg-white px-2 py-0.5 rounded"
              title="Ta bort fil"
            >
              🗑️
            </button>
          </div>
        ))}
      </div>

      {/* Enkel lista på registrerade kvitto/utgift-poster */}
      {expenses.length > 0 && (
        <>
          <h3 className="text-lg font-semibold mb-2">Registrerade kvitton/utgifter</h3>
          <div className="space-y-2 mb-6">
            {expenses.map((e, i) => (
              <div key={i} className="border rounded-lg p-3 text-sm">
                <div className="flex justify-between">
                  <span className="font-semibold">{e.supplier || "Okänd leverantör"}</span>
                  {e.draft ? <span className="text-orange-600">Utkast</span> : <span className="text-green-700">Bokfört</span>}
                </div>
                <div className="mt-1 grid grid-cols-2 gap-2">
                  <div>Belopp inkl. moms: {e.amountIncl.toFixed(2)} kr</div>
                  <div>Moms: {e.vat.toFixed(2)} kr</div>
                  <div>Datum: {e.date}</div>
                  {e.fileName && <div className="break-all">Fil: {e.fileName}</div>}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

            {/* Anteckningar + tillbaka */}
      <textarea
        name="notes"
        value={data.notes}
        onChange={handleChange}
        placeholder="Anteckningar..."
        rows={6}
        className="w-full border p-3 rounded mb-4"
      />
      <div className="flex gap-4 mt-6">
        <Link href="/dashboard">
          <button className="bg-gray-300 hover:bg-gray-400 text-black px-4 py-2 rounded">
            ← Tillbaka
          </button>
        </Link>
      </div>

      {/* Spar-badge i hörnet */}
      <SavingsBadge className="fixed bottom-3 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-sm" />
    </div>
  );
}

