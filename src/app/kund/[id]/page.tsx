"use client";

import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import OfferList from "@/components/OfferList";
import DocumentOverview from "@/components/DocumentOverview";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import LogoutButton from "@/components/LogoutButton";
import OfferRealtime from "./OfferRealtime";

const CustomerCardInfo = dynamic(() => import("@/components/CustomerCardInfo"), { ssr: false });

type DocFile = { name: string; url: string };
type BkFile = { name: string; url: string; type: "image" | "pdf" };

declare global {
  interface Window {
    pdfjsLib?: any;
    handleGptResponse?: any;
  }
}

/* ============================
   Liten IndexedDB-hjälpare
   ============================ */
const DB_NAME = "paperflow-docs";
const STORE = "files";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
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
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const idNumber = parseInt(id as string);

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
    customerNumber: "",
    // Nya fält för offertdata
    offerText: "",
    totalSum: "",
    vatPercent: "",
    vatAmount: "",
    validityDays: ""
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

  // 📚 Bokföring (bilder + PDF:er) – kvar i localStorage tills du vill flytta dem också
  const [bookkeepingFiles, setBookkeepingFiles] = useState<BkFile[]>([]);

  // 🤖 GPT-offertförhandsvisning
  const [gptOfferPreview, setGptOfferPreview] = useState<string>("");
  const [gptOfferPdfUrl, setGptOfferPdfUrl] = useState<string>("");

  // 📄 Dokumentflöde
  const [documents, setDocuments] = useState<any[]>([]);
  const [loadingDocuments, setLoadingDocuments] = useState(false);

  // 🏢 Företagsuppgifter
  const [companyData, setCompanyData] = useState<any>(null);

  // Hålla koll på Blob-URL:er för att kunna revoke() på unmount
  const objectUrlsRef = useRef<string[]>([]);

  // Exponera handleGptResponse globalt för externa GPT-integrationer
  useEffect(() => {
    window.handleGptResponse = handleGptResponse;
    return () => {
      delete window.handleGptResponse;
    };
  }, [data]); // Re-exponera när data ändras

  // Ladda dokument när sidan laddas
  useEffect(() => {
    if (id) {
      loadDocuments();
    }
  }, [id]);

  useEffect(() => {
    // Först försök hämta från den nya strukturen (paperflow_customers_v1)
    const existingCustomers = JSON.parse(localStorage.getItem('paperflow_customers_v1') || '[]');
    const customer = existingCustomers.find((c: any) => String(c.id) === String(idNumber));
    
    if (customer) {
      // Använd data från den nya strukturen
      setData({
        companyName: customer.companyName || "",
        orgNr: customer.orgNr || "",
        contactPerson: customer.contactPerson || "",
        role: customer.role || "",
        phone: customer.phone || "",
        email: customer.email || "",
        address: customer.address || "",
        zip: customer.zip || "",
        city: customer.city || "",
        country: customer.country || "Sverige",
        contactDate: customer.contactDate || "",
        notes: customer.notes || "",
        customerNumber: customer.customerNumber || "",
        // Nya fält för offertdata
        offerText: customer.offerText || "",
        totalSum: customer.totalSum || "",
        vatPercent: customer.vatPercent || "",
        vatAmount: customer.vatAmount || "",
        validityDays: customer.validityDays || ""
      });
    } else {
      // Fallback till gamla strukturen
      const saved = localStorage.getItem(`kund_${idNumber}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        setData({
          ...parsed,
          // Lägg till de nya fälten med tomma värden
          offerText: "",
          totalSum: "",
          vatPercent: "",
          vatAmount: "",
          validityDays: ""
        });
      } else {
        const nyttKundnummer = `K-${Math.floor(100000 + Math.random() * 900000)}`;
        const initialData = { 
          ...data, 
          customerNumber: nyttKundnummer,
          // Lägg till de nya fälten med tomma värden
          offerText: "",
          totalSum: "",
          vatPercent: "",
          vatAmount: "",
          validityDays: ""
        };
        localStorage.setItem(`kund_${idNumber}`, JSON.stringify(initialData));
        setData(initialData);
      }
    }

    const savedImages = localStorage.getItem(`kund_images_${idNumber}`);
    if (savedImages) setImages(JSON.parse(savedImages));

    // Hämta enbart namn från localStorage (URL återskapas från IndexedDB)
    const savedOffertMeta = localStorage.getItem(`kund_offert_${idNumber}`);
    const savedOrderMeta = localStorage.getItem(`kund_order_${idNumber}`);
    const savedInvoiceMeta = localStorage.getItem(`kund_invoice_${idNumber}`);

    async function restoreDoc(type: "offert" | "order" | "invoice", metaStr: string | null) {
      const key = `${type}_${idNumber}`;
      const blob = await idbGet(key);
      if (blob) {
        const name = metaStr ? (JSON.parse(metaStr).name as string) : `${type}.pdf`;
        const url = URL.createObjectURL(blob);
        objectUrlsRef.current.push(url);
        const file = { name, url };
        if (type === "offert") setOffert(file);
        if (type === "order") setOrder(file);
        if (type === "invoice") setInvoice(file);
      }
    }

    Promise.resolve()
      .then(() => restoreDoc("offert", savedOffertMeta))
      .then(() => restoreDoc("order", savedOrderMeta))
      .then(() => restoreDoc("invoice", savedInvoiceMeta))
      .catch(() => {});

    const savedStatus = localStorage.getItem(`kund_sent_${idNumber}`);
    if (savedStatus) setSentStatus(JSON.parse(savedStatus));

    const savedBk = localStorage.getItem(`kund_bookkeeping_${idNumber}`);
    if (savedBk) setBookkeepingFiles(JSON.parse(savedBk));

    return () => {
      objectUrlsRef.current.forEach((u) => URL.revokeObjectURL(u));
      objectUrlsRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idNumber]);

  function persistData(updated: typeof data) {
    // Spara till den nya strukturen (paperflow_customers_v1)
    const existingCustomers = JSON.parse(localStorage.getItem('paperflow_customers_v1') || '[]');
    const customerIndex = existingCustomers.findIndex((c: any) => String(c.id) === String(idNumber));
    
    if (customerIndex !== -1) {
      // Uppdatera befintlig kund
      existingCustomers[customerIndex] = {
        ...existingCustomers[customerIndex],
        companyName: updated.companyName,
        orgNr: updated.orgNr,
        contactPerson: updated.contactPerson,
        role: updated.role,
        phone: updated.phone,
        email: updated.email,
        address: updated.address,
        zip: updated.zip,
        city: updated.city,
        country: updated.country,
        contactDate: updated.contactDate,
        notes: updated.notes,
        customerNumber: updated.customerNumber,
        // Nya fält för offertdata
        offerText: updated.offerText,
        totalSum: updated.totalSum,
        vatPercent: updated.vatPercent,
        vatAmount: updated.vatAmount,
        validityDays: updated.validityDays
      };
      localStorage.setItem('paperflow_customers_v1', JSON.stringify(existingCustomers));
    } else {
      // Fallback till gamla strukturen
      localStorage.setItem(`kund_${idNumber}`, JSON.stringify(updated));
    }
    
    setData(updated);
  }

  // 🧹 Rensa offerttext från box-drawing-tecken
  function cleanOfferText(text: string): string {
    // Ta bort alla box-drawing-tecken (Unicode U+2500-U+257F)
    return text.replace(/[\u2500-\u257F]/g, "");
  }

  // 🤖 Hantera GPT-offertsvar automatiskt
  async function handleGptResponse(gptReply: string) {
    try {
      // 1. Hitta JSON-delen i GPT-svaret med regex
      const jsonMatch = gptReply.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.warn("Ingen JSON hittad i GPT-svar");
        return;
      }

      // 2. Parsa JSON
      const jsonData = JSON.parse(jsonMatch[0]);
      const kund = jsonData.kund || {};

      // 3. Uppdatera kundkortets state med alla fält
      const updatedData = {
        ...data,
        companyName: kund.namn || data.companyName,
        customerNumber: jsonData.offertnummer || data.customerNumber,
        contactPerson: kund.kontaktperson || data.contactPerson,
        email: kund.epost || data.email,
        phone: kund.telefon || data.phone,
        address: kund.adress || data.address,
        zip: kund.postnummer || data.zip,
        city: kund.ort || data.city,
        orgNr: kund.orgnr || data.orgNr,
        contactDate: jsonData.datum || data.contactDate,
        role: kund.befattning || data.role,
        country: kund.land || data.country,
        // Offertdata
        offerText: jsonData.titel || data.offerText,
        totalSum: jsonData.summa || data.totalSum
      };

      persistData(updatedData);

      // 4. Plocka ut textdelen (allt efter JSON)
      const textStart = gptReply.indexOf(jsonMatch[0]) + jsonMatch[0].length;
      const rawTextData = gptReply.substring(textStart).trim();
      
      // 5. Rensa textdelen från box-drawing-tecken
      const cleanTextData = cleanOfferText(rawTextData);
      
      // 6. Spara textdelen i state för förhandsvisning
      setGptOfferPreview(cleanTextData);

      // 7. Spara i Supabase documents-tabellen med rensad text
      const response = await fetch('/api/documents/create-from-gpt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: id as string,
          jsonData: jsonData,
          textData: cleanTextData
        })
      });

      if (response.ok) {
        const result = await response.json();
        setGptOfferPdfUrl(result.pdfUrl);
        console.log('GPT-offert sparad i Supabase:', result);
      } else {
        console.error('Fel vid sparande av GPT-offert:', await response.text());
      }

    } catch (error) {
      console.error('Fel vid hantering av GPT-svar:', error);
    }
  }

  // 🔍 Testfunktion för GPT-offertsvar
  async function testGptResponse() {
    const testGptReply = `{
  "customerId": "test-customer-123",
  "title": "Offert – Renovering",
  "amount": 45000,
  "currency": "SEK",
  "needsPrint": false,
  "dataJson": {
    "kund": {
      "namn": "Bygg AB",
      "offertnummer": "K-527072",
      "kontaktperson": "Anna Andersson",
      "epost": "anna@byggab.se",
      "telefon": "070-1234567",
      "adress": "Byggvägen 12",
      "postnummer": "12345",
      "ort": "Stockholm",
      "orgnr": "556677-8899",
      "datum": "2025-09-17",
      "befattning": "VD",
      "land": "Sverige"
    }
  }
}

Offertinnehåll:
[LOGOTYP HÄR]

OFFERT

Kund: Bygg AB
Datum: 2025-09-17
Offertnummer: K-527072

Kundinformation:
Org.nr: 556677-8899
Adress: Byggvägen 12
Kontaktperson: Anna Andersson
Telefon: 070-1234567
E-post: anna@byggab.se

Tjänster:
┌─────────────────┬─────────┬─────────────┬─────────┐
│ Tjänst          │ Timmar  │ Pris/tim    │ Totalt  │
├─────────────────┼─────────┼─────────────┼─────────┤
│ Renovering      │ 50      │ 800 SEK     │ 40 000  │
│ Material        │ -       │ -           │ 5 000   │
└─────────────────┴─────────┴─────────────┴─────────┘

Totalsumma: 45 000 SEK exkl. moms

Betalningsvillkor:
Betaltid: 30 dagar
Dröjsmålsränta: 8% enligt räntelagen
Fakturamottagare: faktura@example.se
Bankgiro: 123-4567
Notis: Moms tillkommer

GDPR:
Vi hanterar kunduppgifter enligt Dataskyddsförordningen (GDPR). Personuppgifter används endast för att uppfylla avtal, hantera fakturering och kundkontakt.

Giltighet:
Denna offert är giltig i 30 dagar från utskriftsdatum. Priser anges exklusive moms.

Signatur:
[Namn och e-post på undertecknare]`;

    try {
      await handleGptResponse(testGptReply);
      alert('✅ Test GPT-offert hanterad! Kontrollera att kundkortet fyllts i och att förhandsvisningen visas (box-drawing-tecken rensade).');
    } catch (error) {
      console.error('Test GPT-offert fel:', error);
      alert('❌ Test GPT-offert misslyckades. Kontrollera konsolen för detaljer.');
    }
  }

  // 📄 Hämta dokument för kunden
  async function loadDocuments() {
    setLoadingDocuments(true);
    try {
      const response = await fetch(`/api/documents/list?customerId=${id}`);
      if (response.ok) {
        const data = await response.json();
        setDocuments(data.documents || []);
        
        // Hämta företagsdata från senaste dokument
        if (data.documents && data.documents.length > 0) {
          const latestDoc = data.documents[0];
          if (latestDoc.data_json && latestDoc.data_json.foretag) {
            setCompanyData(latestDoc.data_json.foretag);
          }
        }
      } else {
        console.error("Fel vid hämtning av dokument:", await response.text());
      }
    } catch (error) {
      console.error("Fel vid hämtning av dokument:", error);
    } finally {
      setLoadingDocuments(false);
    }
  }

  // 📑 Skapa orderbekräftelse
  async function createOrderConfirmation() {
    try {
      const response = await fetch('/api/documents/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: id
        })
      });

      if (response.ok) {
        const result = await response.json();
        alert(`✅ ${result.message}`);
        loadDocuments(); // Uppdatera dokumentlista
      } else {
        const error = await response.text();
        alert(`❌ Fel vid skapande av orderbekräftelse: ${error}`);
      }
    } catch (error) {
      console.error("Fel vid skapande av orderbekräftelse:", error);
      alert("❌ Fel vid skapande av orderbekräftelse");
    }
  }

  // 💰 Skapa faktura
  async function createInvoice() {
    try {
      const response = await fetch('/api/documents/create-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: id
        })
      });

      if (response.ok) {
        const result = await response.json();
        alert(`✅ ${result.message}`);
        loadDocuments(); // Uppdatera dokumentlista
      } else {
        const error = await response.text();
        alert(`❌ Fel vid skapande av faktura: ${error}`);
      }
    } catch (error) {
      console.error("Fel vid skapande av faktura:", error);
      alert("❌ Fel vid skapande av faktura");
    }
  }

  // 📤 Skicka till bokföring
  async function sendToBookkeeping() {
    try {
      const response = await fetch('/api/documents/send-to-bookkeeping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: id
        })
      });

      if (response.ok) {
        const result = await response.json();
        alert(`✅ ${result.message}`);
        loadDocuments(); // Uppdatera dokumentlista
      } else {
        const error = await response.text();
        alert(`❌ Fel vid skickande till bokföring: ${error}`);
      }
    } catch (error) {
      console.error("Fel vid skickande till bokföring:", error);
      alert("❌ Fel vid skickande till bokföring");
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value } = e.target;
    const updated = { ...data, [name]: value };
    persistData(updated);
  }

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
          localStorage.setItem(`kund_images_${idNumber}`, JSON.stringify(updated));
          return updated;
        });
      };
      reader.readAsDataURL(file);
    });
  }

  function deleteImage(index: number) {
    setImages((prev) => {
      const updated = [...prev.slice(0, index), ...prev.slice(index + 1)];
      localStorage.setItem(`kund_images_${idNumber}`, JSON.stringify(updated));
      return updated;
    });
  }

  // === Ladda PDF.js (via CDN) exakt en gång ===
  async function loadPdfJsOnce(): Promise<any> {
    if (window.pdfjsLib) return window.pdfjsLib;

    await new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Kunde inte ladda PDF.js"));
      document.head.appendChild(script);
    });

    const pdfjsLib = window.pdfjsLib!;
    try {
      pdfjsLib.GlobalWorkerOptions.workerSrc =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
    } catch {}
    return pdfjsLib;
  }

  // === Läs ut text från PDF (alla sidor) ===
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
    } catch (err) {
      console.warn("PDF-textutvinning misslyckades:", err);
      return "";
    }
  }

  // Hjälpare för parser
  function normalize(s: string) {
    return s
      .replace(/\u2011|\u2013|\u2014/g, "-")
      .replace(/\u00A0/g, " ")
      .replace(/[^\S\r\n]+/g, " ");
  }
  function formatZip(zip: string) {
    const only = (zip || "").replace(/\D/g, "");
    if (only.length === 5) return `${only.slice(0, 3)} ${only.slice(3)}`;
    return (zip || "").trim();
  }

  // === Parser (säker, null-guarded) ===
  function parseFieldsFromText(txt: string, filename?: string) {
    try {
      const norm = normalize(txt || "");
      const safeGet = (regex: RegExp) => {
        const m = norm.match(regex);
        return (m && m[1] ? String(m[1]).trim() : "");
      };

      const kund = safeGet(/(?:Kund|Beställare|Företag|Kundnamn)\s*:?\s*(.+)/i);
      const datum = safeGet(/(?:Datum|Offertdatum)\s*:?\s*([0-9]{4}-[0-9]{2}-[0-9]{2}|[0-9]{2}[-/.][0-9]{2}[-/.][0-9]{2,4})/i);
      let offertnr = safeGet(/(?:Offert(?:nummer|\s*nr\.?)?|Offert-Nr\.?)\s*:?\s*([A-Za-z0-9\-_/]+)/i);

      const orgnr =
        safeGet(/(?:Org(?:\.|\s)?(?:nr|nummer)|Organisations(?:nummer|nr))\s*:?\s*([0-9\- ]{6,})/i) ||
        safeGet(/(?:VAT|Momsregnr|VAT(?:\s*nr)?)\s*:?\s*([A-Za-z0-9\- ]{6,})/i);

      let adress =
        safeGet(/(?:Adress|Gatuadress|Besöksadress)\s*:?\s*(.+)/i) ||
        safeGet(/(?:Postadress)\s*:?\s*(.+)/i);

      const postrad = (() => {
        const a = norm.match(/(?:Postnr(?:\.|)|Postnummer|Postadress)\s*:?\s*([0-9]{3}\s?[0-9]{2}\s+[^\n]+)/i);
        if (a && a[1]) return a[1];
        const b = norm.match(/([0-9]{3}\s?[0-9]{2})\s+([A-Za-zÅÄÖåäö\- ]{2,})/);
        if (b && b[0]) return b[0];
        return "";
      })();

      const telefon = safeGet(/(?:Telefon|Tel\.?|Tel)\s*:?\s*([\d +\-()]{5,})/i);
      const email = safeGet(/(?:E-?post|E ?post|E-mail|Mail)\s*:?\s*([^\s,;<>]+@[^\s,;<>]+)/i);
      const kontaktperson = safeGet(/(?:Kontaktperson|Kontakt)\s*:?\s*([^\n]+)/i);
      const land = safeGet(/(?:Land|Country)\s*:?\s*([^\n]+)/i);

      let street = adress || "";
      let zip = "";
      let city = "";

      if (adress) {
        const parts = adress.split(",").map((s) => s.trim()).filter(Boolean);
        if (parts.length >= 2) {
          street = parts[0];
          const tail = parts.slice(1).join(", ");
          const m = tail.match(/(\d{3}\s?\d{2})\s+(.+)/);
          if (m && m[1] && m[2]) {
            zip = formatZip(m[1]);
            city = String(m[2]).trim();
          } else if (!city) {
            city = tail;
          }
        }
      }

      if ((!zip || !city) && postrad) {
        const m2 = postrad.match(/(\d{3}\s?\d{2})\s+(.+)/);
        if (m2 && m2[1] && m2[2]) {
          zip = formatZip(m2[1]);
          city = String(m2[2]).trim();
        }
      }

      let companyGuess = kund || "";
      if (!companyGuess) {
        const firstLines = norm.split("\n").slice(0, 12).map(s => s.trim()).filter(Boolean);
        const stopIdx = firstLines.findIndex(l => /offert|order|faktura/i.test(l));
        const scope = stopIdx > 0 ? firstLines.slice(0, stopIdx) : firstLines;
        const cand = scope.find(l =>
          /[A-Za-zÅÄÖåäö]/.test(l) && l.split(" ").length >= 2 && l.length <= 60
        );
        if (cand) companyGuess = cand.replace(/^(AB|HB|KB)\s+/i, "").trim();
      }

      if (!offertnr && filename) {
        const m = filename.match(/(offert|offer|off)\s*[-_ ]?\s*([A-Za-z0-9\-_/]+)/i);
        if (m && m[2]) offertnr = m[2];
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

      return Object.fromEntries(
        Object.entries(mapped).map(([k, v]) => [k, (data as any)[k] || v])
      ) as Partial<typeof data>;
    } catch (e) {
      console.warn("parseFieldsFromText fel:", e);
      return {};
    }
  }

  // === Nollställ kundkortet (när offerten raderas) ===
  function resetCustomerCard() {
    const nyttKundnummer = `K-${Math.floor(100000 + Math.random() * 900000)}`;
    const tomData = {
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
      customerNumber: nyttKundnummer,
      // Nya fält för offertdata
      offerText: "",
      totalSum: "",
      vatPercent: "",
      vatAmount: "",
      validityDays: ""
    };
    localStorage.setItem(`kund_${idNumber}`, JSON.stringify(tomData));
    setData(tomData);

    const newStatus = { ...sentStatus, offert: "" };
    setSentStatus(newStatus);
    localStorage.setItem(`kund_sent_${idNumber}`, JSON.stringify(newStatus));
  }

  // === Uppladdning (IndexedDB + säker reset av input) ===
  async function handleSpecialUpload(
    e: React.ChangeEvent<HTMLInputElement>,
    type: "offert" | "order" | "invoice"
  ) {
    const inputEl = e.currentTarget as HTMLInputElement;
    const uploaded = inputEl.files?.[0];
    if (!uploaded) {
      inputEl.value = "";
      return;
    }

    try {
      // 1) Spara filen (Blob) i IndexedDB
      const key = `${type}_${idNumber}`;
      await idbSet(key, uploaded);

      // 2) Skapa objectURL för visning nu
      const url = URL.createObjectURL(uploaded);
      objectUrlsRef.current.push(url);

      // 3) Spara ENDAST filnamnet i localStorage
      const meta = { name: uploaded.name };
      localStorage.setItem(`kund_${type}_${idNumber}`, JSON.stringify(meta));

      // 4) Uppdatera state
      const newFile = { name: uploaded.name, url };
      if (type === "offert") setOffert(newFile);
      if (type === "order") setOrder(newFile);
      if (type === "invoice") setInvoice(newFile);

      // 5) Autofyll vid offert och spara i Supabase
      if (type === "offert") {
        try {
          // Konvertera PDF till base64
          const arrayBuffer = await uploaded.arrayBuffer();
          const base64 = Buffer.from(arrayBuffer).toString('base64');
          
          // Skicka till API för att extrahera text och spara i Supabase
          const response = await fetch('/api/pdf-extract-and-parse', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              pdfBase64: base64,
              customerId: id as string
            })
          });

          if (response.ok) {
            const result = await response.json();
            const parsedData = result.parsedData;
            
            // Fyll i kundkortets fält automatiskt
            const mapped = {
              companyName: parsedData.customerName || "",
              orgNr: parsedData.orgNr || "",
              address: parsedData.address || "",
              email: parsedData.email || "",
              phone: parsedData.phone || "",
              // Lägg till offertdata
              offerText: result.offer?.data_json?.extractedText || "",
              totalSum: parsedData.amount || 0,
              currency: parsedData.currency || "SEK"
            };
            
            const updated = { ...data, ...mapped };
            persistData(updated);
            console.log("Autofyllda fält och sparad i Supabase:", mapped);
            
            // Visa bekräftelse
            alert(`Offert extraherad och sparad i Supabase!\nKund: ${parsedData.customerName}\nBelopp: ${parsedData.amount} ${parsedData.currency}`);
          } else {
            console.error("API error:", await response.text());
            // Fallback till befintlig logik
            const text = await extractTextFromPDF(uploaded);
            if (text && text.trim().length > 0) {
              const mapped = parseFieldsFromText(text, uploaded.name);
              const updated = { ...data, ...mapped };
              persistData(updated);
              console.log("Autofyllda fält (fallback):", mapped);
            }
          }
        } catch (error) {
          console.error("Error processing PDF:", error);
          // Fallback till befintlig logik
          const text = await extractTextFromPDF(uploaded);
          if (text && text.trim().length > 0) {
            const mapped = parseFieldsFromText(text, uploaded.name);
            const updated = { ...data, ...mapped };
            persistData(updated);
            console.log("Autofyllda fält (fallback):", mapped);
          }
        }
      }
    } finally {
      // ✅ säkert att nollställa efter async
      inputEl.value = "";
    }
  }

  async function skickaEpost(pdfUrl: string, typ: string) {
    if (!data.email || data.email.trim() === "") {
      alert("Fyll i kundens e-postadress innan du skickar.");
      return;
    }

    const subject = `Här kommer din ${typ} från ${data.companyName || "oss"}`;
    const text = `Hej ${data.contactPerson || "kund"},\n\nHär kommer din ${typ}.\n\nLänk: ${pdfUrl}`;

    await fetch("/api/sendEmail", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: data.email, subject, text }),
    });

    const now = new Date().toLocaleDateString("sv-SE", {
      year: "numeric", month: "2-digit", day: "2-digit"
    });

    const newStatus = { ...sentStatus, [typ]: now };
    setSentStatus(newStatus);
    localStorage.setItem(`kund_sent_${idNumber}`, JSON.stringify(newStatus));

    alert(`${typ} skickad till ${data.email}`);
  }

  function printPdf(pdfUrl: string) {
    const win = window.open();
    if (!win) return;
    win.document.write(
      `<iframe src="${pdfUrl}" frameborder="0" style="width:100%;height:100%;" allowfullscreen></iframe>`
    );
    win.document.close();
    win.focus();
    win.print();
  }

  // 📚 Bokföring
  function handleBookkeepingUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const uploaded = e.target.files;
    if (!uploaded || uploaded.length === 0) return;

    const files = Array.from(uploaded);

    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const type: "image" | "pdf" = file.type.startsWith("image/") ? "image" : "pdf";
        const entry: BkFile = { name: file.name, url: result, type };
        setBookkeepingFiles((prev) => {
          const updated = [...prev, entry];
          localStorage.setItem(`kund_bookkeeping_${idNumber}`, JSON.stringify(updated));
          return updated;
        });
      };
      reader.readAsDataURL(file);
    });

    e.currentTarget.value = "";
  }

  function deleteBookkeeping(index: number) {
    setBookkeepingFiles((prev) => {
      const updated = [...prev.slice(0, index), ...prev.slice(index + 1)];
      localStorage.setItem(`kund_bookkeeping_${idNumber}`, JSON.stringify(updated));
      return updated;
    });
  }

  // Ta bort en huvud-PDF
  async function removeDoc(type: "offert" | "order" | "invoice") {
    const key = `${type}_${idNumber}`;
    await idbDel(key);
    localStorage.removeItem(`kund_${type}_${idNumber}`);

    if (type === "offert") setOffert(null);
    if (type === "order") setOrder(null);
    if (type === "invoice") setInvoice(null);
  }

            return (
            <div className="min-h-screen bg-white p-6 text-gray-800 max-w-4xl mx-auto">
              <LogoutButton />
              
              {/* Lokal utvecklingsbanner */}
              {process.env.NODE_ENV === 'development' && (
                <div className="bg-yellow-400 text-black text-center py-2 px-4 rounded-md mb-4 font-semibold">
                  DU ÄR I LOKAL VERSION (localhost:3000)
                </div>
              )}
              
              <h1 className="text-3xl font-bold mb-6">Kundkort</h1>

      {/* Till bokföringen-knapp */}
      <div className="mb-4 flex justify-between">
        <Link
          href="/start"
          className="bg-green-600 text-white px-4 py-2 rounded text-sm hover:bg-green-700 transition-colors"
        >
          🏠 Tillbaka till Start
        </Link>
        <Link
          href="/dashboard/bookkeepingboard"
          className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 transition-colors"
        >
          Till bokföringen →
        </Link>
      </div>

      {/* Kunduppgifter – visas högt upp, mobilvänligt */}
      <section className="mt-3 mb-4">
        <CustomerCardInfo customerId={id as string} />
      </section>

      {/* Dokumentöversikt – liknande bokföringsprogram */}
      <section id="dokument" className="mt-3 mb-6">
        <h2 className="text-lg font-semibold mb-2 text-gray-800">Dokumentöversikt</h2>
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <DocumentOverview customerId={id as string} />
        </div>
      </section>

      {/* Offerter – placerad högt upp under knapparna (mobilvänlig) */}
      <section id="offerter" className="mt-3 mb-6">
        <h2 className="text-lg font-semibold mb-2 text-gray-800 flex items-center gap-2">
          Offerter
          <span className="text-xs text-gray-500">
            <span className="text-green-600">✓ Klar</span> • 
            <span className="text-orange-600">⚠ Skickad</span> • 
            <span className="text-red-600">✗ Ej skickad</span>
          </span>
        </h2>
        <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
          <OfferList 
            customerId={id as string} 
            customerEmail={data.email} 
            onEmailUpdate={(email) => {
              const updated = { ...data, email };
              persistData(updated);
            }}
          />
        </div>
      </section>

      {/* === Kunduppgifter med rubriker === */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <div className="flex flex-col">
          <label htmlFor="companyName" className="text-sm text-gray-600 mb-1">Företagsnamn</label>
          <input id="companyName" name="companyName" value={data.companyName} onChange={handleChange} className="border p-2 rounded" />
        </div>

        <div className="flex flex-col">
          <label htmlFor="customerNumber" className="text-sm text-gray-600 mb-1">Kundnummer (från Offertnummer)</label>
          <input id="customerNumber" name="customerNumber" value={data.customerNumber} onChange={handleChange} className="border p-2 rounded" />
        </div>

        <div className="flex flex-col">
          <label htmlFor="contactPerson" className="text-sm text-gray-600 mb-1">Kontaktperson</label>
          <input id="contactPerson" name="contactPerson" value={data.contactPerson} onChange={handleChange} className="border p-2 rounded" />
        </div>

        <div className="flex flex-col">
          <label htmlFor="email" className="text-sm text-gray-600 mb-1">E-post</label>
          <input id="email" name="email" value={data.email} onChange={handleChange} className="border p-2 rounded" />
        </div>

        <div className="flex flex-col">
          <label htmlFor="phone" className="text-sm text-gray-600 mb-1">Telefon</label>
          <input id="phone" name="phone" value={data.phone} onChange={handleChange} className="border p-2 rounded" />
        </div>

        <div className="flex flex-col">
          <label htmlFor="address" className="text-sm text-gray-600 mb-1">Adress</label>
          <input id="address" name="address" value={data.address} onChange={handleChange} className="border p-2 rounded" />
        </div>

        <div className="flex flex-col">
          <label htmlFor="zip" className="text-sm text-gray-600 mb-1">Postnummer</label>
          <input id="zip" name="zip" value={data.zip} onChange={handleChange} className="border p-2 rounded" />
        </div>

        <div className="flex flex-col">
          <label htmlFor="city" className="text-sm text-gray-600 mb-1">Ort</label>
          <input id="city" name="city" value={data.city} onChange={handleChange} className="border p-2 rounded" />
        </div>

        <div className="flex flex-col">
          <label htmlFor="orgNr" className="text-sm text-gray-600 mb-1">Org.nr</label>
          <input id="orgNr" name="orgNr" value={data.orgNr} onChange={handleChange} className="border p-2 rounded" />
        </div>

        <div className="flex flex-col">
          <label htmlFor="contactDate" className="text-sm text-gray-600 mb-1">Datum</label>
          <input id="contactDate" name="contactDate" type="date" value={data.contactDate} onChange={handleChange} className="border p-2 rounded" />
        </div>

        {/* Behåller extra fält */}
        <div className="flex flex-col">
          <label htmlFor="role" className="text-sm text-gray-600 mb-1">Befattning</label>
          <input id="role" name="role" value={data.role} onChange={handleChange} className="border p-2 rounded" />
        </div>

        <div className="flex flex-col">
          <label htmlFor="country" className="text-sm text-gray-600 mb-1">Land</label>
          <input id="country" name="country" value={data.country} onChange={handleChange} className="border p-2 rounded" />
        </div>
      </div>

      {/* === Företagsuppgifter === */}
      {companyData && (
        <div className="mb-6">
          <h2 className="text-xl font-bold mb-4">🏢 Företagsuppgifter</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            {companyData.namn && (
              <div className="flex flex-col">
                <label className="text-sm text-gray-600 mb-1">Namn</label>
                <div className="border p-2 rounded bg-gray-50">{companyData.namn}</div>
              </div>
            )}
            
            {companyData.orgnr && (
              <div className="flex flex-col">
                <label className="text-sm text-gray-600 mb-1">Org.nr</label>
                <div className="border p-2 rounded bg-gray-50">{companyData.orgnr}</div>
              </div>
            )}
            
            {companyData.adress && (
              <div className="flex flex-col">
                <label className="text-sm text-gray-600 mb-1">Adress</label>
                <div className="border p-2 rounded bg-gray-50">{companyData.adress}</div>
              </div>
            )}
            
            {companyData.epost && (
              <div className="flex flex-col">
                <label className="text-sm text-gray-600 mb-1">E-post</label>
                <div className="border p-2 rounded bg-gray-50">{companyData.epost}</div>
              </div>
            )}
            
            {companyData.telefon && (
              <div className="flex flex-col">
                <label className="text-sm text-gray-600 mb-1">Telefon</label>
                <div className="border p-2 rounded bg-gray-50">{companyData.telefon}</div>
              </div>
            )}
            
            {companyData.logotyp && (
              <div className="flex flex-col sm:col-span-2">
                <label className="text-sm text-gray-600 mb-1">Logotyp</label>
                <div className="border p-2 rounded bg-gray-50">
                  <img 
                    src={companyData.logotyp} 
                    alt="Företagslogotyp" 
                    className="max-w-32 max-h-16 object-contain"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* === Offertdata (om de finns) === */}
      {(data.totalSum || data.vatPercent || data.vatAmount || data.validityDays) && (
        <div className="mb-6">
          <h2 className="text-xl font-bold mb-4">💰 Offertdata</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            {data.totalSum && (
              <div className="flex flex-col">
                <label htmlFor="totalSum" className="text-sm text-gray-600 mb-1">Totalsumma</label>
                <input id="totalSum" name="totalSum" value={data.totalSum} onChange={handleChange} className="border p-2 rounded" />
              </div>
            )}
            
            {data.vatPercent && (
              <div className="flex flex-col">
                <label htmlFor="vatPercent" className="text-sm text-gray-600 mb-1">Moms %</label>
                <input id="vatPercent" name="vatPercent" value={data.vatPercent} onChange={handleChange} className="border p-2 rounded" />
              </div>
            )}
            
            {data.vatAmount && (
              <div className="flex flex-col">
                <label htmlFor="vatAmount" className="text-sm text-gray-600 mb-1">Moms belopp</label>
                <input id="vatAmount" name="vatAmount" value={data.vatAmount} onChange={handleChange} className="border p-2 rounded" />
              </div>
            )}
            
            {data.validityDays && (
              <div className="flex flex-col">
                <label htmlFor="validityDays" className="text-sm text-gray-600 mb-1">Giltighet (dagar)</label>
                <input id="validityDays" name="validityDays" value={data.validityDays} onChange={handleChange} className="border p-2 rounded" />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Offerter */}
      <OfferRealtime customerId={String(id)} />

      <h2 className="text-xl font-bold mt-8">📷 Bilder och kladdlappar</h2>
      <input type="file" accept="image/*" multiple onChange={handleImageUpload} className="mt-2 mb-4 text-blue-700 font-semibold cursor-pointer" />
      <div className="grid grid-cols-2 gap-4 mb-6">
        {images.map((img, idx) => (
          <div key={idx} className="border p-2 rounded shadow relative">
            <img src={img.url} alt={img.name} className="w-full h-auto rounded" />
            <p className="text-xs mt-1 break-all">{img.name}</p>
            <button
              onClick={() => deleteImage(idx)}
              className="absolute top-1 right-1 text-red-600 text-sm font-bold bg-white px-2 py-0.5 rounded"
              title="Ta bort bild"
            >
              🗑️
            </button>
          </div>
        ))}
      </div>

      <h2 className="text-xl font-bold mt-8">GPT-genererade dokument</h2>

      {/* Offert */}
      <div className="mb-4">
        <p className="font-semibold">🧾 Offert (PDF):</p>
        <input
          type="file"
          accept="application/pdf"
          onChange={(e) => handleSpecialUpload(e, "offert")}
          className="text-blue-700 font-semibold cursor-pointer"
        />
        {offert && (
          <div className="mt-2 space-y-2">
            <div className="flex justify-between items-center gap-4">
              <p className="text-sm text-blue-600">📎 {offert.name}</p>
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    await removeDoc("offert");
                    resetCustomerCard();
                  }}
                  className="text-red-600 text-sm font-semibold hover:underline"
                >
                  🗑️ Ta bort
                </button>
              </div>
            </div>
            <iframe src={offert.url} className="w-full h-64 border rounded" title="Offert PDF"></iframe>
            <div className="flex gap-2 mt-2">
              <button onClick={() => skickaEpost(offert.url, "offert")} className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700">
                📤 Skicka
              </button>
              <button onClick={() => printPdf(offert.url)} className="bg-gray-300 px-3 py-1 rounded hover:bg-gray-400">🖨️ Skriv ut</button>
              {sentStatus["offert"] && <p className="text-green-600 text-sm">✔️ Skickad {sentStatus["offert"]}</p>}
            </div>
          </div>
        )}
      </div>

      {/* Order */}
      <div className="mb-4">
        <p className="font-semibold">📑 Orderbekräftelse (PDF):</p>
        <input
          type="file"
          accept="application/pdf"
          onChange={(e) => handleSpecialUpload(e, "order")}
          className="text-blue-700 font-semibold cursor-pointer"
        />
        {order && (
          <div className="mt-2 space-y-2">
            <div className="flex justify-between items-center">
              <p className="text-sm text-blue-600">📎 {order.name}</p>
              <button
                onClick={async () => { await removeDoc("order"); }}
                className="text-red-600 text-sm font-semibold hover:underline"
              >
                🗑️ Ta bort
              </button>
            </div>
            <iframe src={order.url} className="w-full h-64 border rounded" title="Order PDF"></iframe>
            <div className="flex gap-2 mt-2">
              <button onClick={() => skickaEpost(order.url, "order")} className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700">
                📤 Skicka
              </button>
              <button onClick={() => printPdf(order.url)} className="bg-gray-300 px-3 py-1 rounded hover:bg-gray-400">🖨️ Skriv ut</button>
              {sentStatus["order"] && <p className="text-green-600 text-sm">✔️ Skickad {sentStatus["order"]}</p>}
            </div>
          </div>
        )}
      </div>

      {/* Faktura */}
      <div className="mb-4">
        <p className="font-semibold">💰 Faktura (PDF):</p>
        <input
          type="file"
          accept="application/pdf"
          onChange={(e) => handleSpecialUpload(e, "invoice")}
          className="text-blue-700 font-semibold cursor-pointer"
        />
        {invoice && (
          <div className="mt-2 space-y-2">
            <div className="flex justify-between items-center">
              <p className="text-sm text-blue-600">📎 {invoice.name}</p>
              <button
                onClick={async () => { await removeDoc("invoice"); }}
                className="text-red-600 text-sm font-semibold hover:underline"
              >
                🗑️ Ta bort
              </button>
            </div>
            <iframe src={invoice.url} className="w-full h-64 border rounded" title="Faktura PDF"></iframe>
            <div className="flex gap-2 mt-2">
              <button onClick={() => skickaEpost(invoice.url, "invoice")} className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700">
                📤 Skicka
              </button>
              <button onClick={() => printPdf(invoice.url)} className="bg-gray-300 px-3 py-1 rounded hover:bg-gray-400">🖨️ Skriv ut</button>
              {sentStatus["invoice"] && <p className="text-green-600 text-sm">✔️ Skickad {sentStatus["invoice"]}</p>}
            </div>
          </div>
        )}
      </div>

      {/* 📚 Bokföring */}
      <h2 className="text-xl font-bold mt-8">📚 Bokföring</h2>
      <p className="text-sm text-gray-700 mb-2">Ladda upp kvitton (bild) eller underlag (PDF). Allt sparas lokalt för kunden.</p>
      <input
        type="file"
        accept="image/*,application/pdf"
        multiple
        onChange={handleBookkeepingUpload}
        className="text-blue-700 font-semibold cursor-pointer mb-4"
      />
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

      <textarea name="notes" value={data.notes} onChange={handleChange} placeholder="Anteckningar..." rows={6} className="w-full border p-3 rounded mb-4" />

      {/* === Offerttext (om den finns) === */}
      {data.offerText && (
        <div className="mb-6">
          <h2 className="text-xl font-bold mb-4">📄 Offerttext från chatten</h2>
          <div className="border p-4 rounded bg-gray-50">
            <pre className="whitespace-pre-wrap text-sm font-mono">{data.offerText}</pre>
          </div>
        </div>
      )}

      {/* === GPT-offertförhandsvisning === */}
      {gptOfferPreview && (
        <div className="mb-6">
          <h2 className="text-xl font-bold mb-4">🤖 GPT-offertförhandsvisning</h2>
          <div className="border p-4 rounded bg-blue-50">
            <pre className="whitespace-pre-wrap text-sm">{gptOfferPreview}</pre>
            {gptOfferPdfUrl && (
              <div className="mt-4 flex gap-2">
                <a 
                  href={gptOfferPdfUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                >
                  📄 Öppna PDF
                </a>
                <button 
                  onClick={() => printPdf(gptOfferPdfUrl)} 
                  className="bg-gray-300 px-4 py-2 rounded hover:bg-gray-400"
                >
                  🖨️ Skriv ut
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* === Testfunktion för GPT-offert === */}
      <div className="mb-6">
        <h2 className="text-xl font-bold mb-4">🔍 Testfunktioner</h2>
        <div className="border p-4 rounded bg-yellow-50">
          <p className="text-sm text-gray-700 mb-3">Testa GPT-offertsvar hantering med hårdkodat exempel:</p>
          <button 
            onClick={testGptResponse}
            className="bg-yellow-600 text-white px-4 py-2 rounded hover:bg-yellow-700 font-semibold"
          >
            🔍 Testa GPT-offert
          </button>
        </div>
      </div>

      {/* === Dokumentflöde === */}
      <div className="mb-6">
        <h2 className="text-xl font-bold mb-4">📄 Dokumentflöde</h2>
        
        {/* Dokumentlista */}
        <div className="mb-4">
          <h3 className="text-lg font-semibold mb-2">Befintliga dokument:</h3>
          {loadingDocuments ? (
            <p className="text-gray-500">Laddar dokument...</p>
          ) : documents.length === 0 ? (
            <p className="text-gray-500">Inga dokument ännu</p>
          ) : (
            <div className="space-y-2">
              {documents.map((doc) => (
                <div key={doc.id} className="border p-3 rounded bg-gray-50">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold">
                        {doc.type === 'offert' && '🧾'} 
                        {doc.type === 'order' && '📑'} 
                        {doc.type === 'faktura' && '💰'} 
                        {doc.title}
                      </p>
                      <p className="text-sm text-gray-600">
                        {doc.amount} {doc.currency} • {new Date(doc.created_at).toLocaleDateString('sv-SE')}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {doc.type === 'offert' && (
                        <button
                          onClick={() => createOrderConfirmation()}
                          className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
                        >
                          📑 Skapa orderbekräftelse
                        </button>
                      )}
                      {doc.type === 'order' && (
                        <button
                          onClick={() => createInvoice()}
                          className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700"
                        >
                          💰 Skapa faktura
                        </button>
                      )}
                      {doc.type === 'faktura' && (
                        <button
                          onClick={() => sendToBookkeeping()}
                          className="bg-purple-600 text-white px-3 py-1 rounded text-sm hover:bg-purple-700"
                        >
                          📤 Skicka till bokföring
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Snabbknappar för dokumentflöde */}
        <div className="border p-4 rounded bg-blue-50">
          <h3 className="text-lg font-semibold mb-3">Dokumentflöde:</h3>
          <div className="flex flex-wrap gap-2 mb-3">
            <span className="text-sm text-gray-600">🧾 Offert → 📑 Orderbekräftelse → 💰 Faktura → 📤 Bokföring</span>
          </div>
          
          {/* Snabbknappar för att skapa nästa dokument i kedjan */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => createOrderConfirmation()}
              className="bg-blue-600 text-white px-3 py-2 rounded text-sm hover:bg-blue-700"
            >
              📑 Skapa orderbekräftelse från senaste offert
            </button>
            <button
              onClick={() => createInvoice()}
              className="bg-green-600 text-white px-3 py-2 rounded text-sm hover:bg-green-700"
            >
              💰 Skapa faktura från senaste order
            </button>
            <button
              onClick={() => sendToBookkeeping()}
              className="bg-purple-600 text-white px-3 py-2 rounded text-sm hover:bg-purple-700"
            >
              📤 Skicka senaste faktura till bokföring
            </button>
          </div>
          
          <p className="text-xs text-gray-500 mt-2">
            Snabbknappar skapar nästa dokument i kedjan automatiskt från senaste dokumentet av rätt typ
          </p>
        </div>
      </div>

      <div className="flex gap-4 mt-6">
        <Link href="/dashboard"><button className="bg-gray-300 hover:bg-gray-400 text-black px-4 py-2 rounded">← Tillbaka</button></Link>
      </div>
    </div>
  );
}
