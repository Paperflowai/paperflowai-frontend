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
  const params = useParams();
  const routeCustomerId = params?.id as string;
  const router = useRouter();
  const idNumber = parseInt(routeCustomerId);

  const [data, setData] = useState({
    companyName: "",
    orgNr: "",
    contactPerson: "",
    role: "",
    position: "",
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
    title: "",
    amount: "",
    currency: "SEK",
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
    if (routeCustomerId) {
      loadDocuments();
    }
  }, [routeCustomerId]);

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
        position: customer.position || "",
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
        title: customer.title || "",
        amount: customer.amount || "",
        currency: customer.currency || "SEK",
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
          title: "",
          amount: "",
          currency: "SEK",
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

  // 🔗 Generera säker kundkortslänk (aldrig låt GPT styra detta)
  function getCustomerCardUrl(): string {
    const baseUrl = typeof window !== 'undefined'
      ? window.location.origin
      : (process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000');
    
    return `${baseUrl}/kund/${routeCustomerId}`;
  }

  // 🤖 Hantera GPT-offertsvar automatiskt
  async function handleGptResponse(gptReply: string) {
    try {
      // 1. Hitta JSON-delen i GPT-svaret med robust regex (första giltiga { ... })
      const jsonMatch = gptReply.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.warn("Ingen JSON hittad i GPT-svar");
        return;
      }

      // 2. Parsa JSON
      const jsonData = JSON.parse(jsonMatch[0]);
      
      // 3. Tvinga customerId från route (inte från GPT)
      jsonData.customerId = routeCustomerId;

      // 4. Mappa ALLA kundfält från parsed.dataJson.kund till state
      const kundData = jsonData.dataJson?.kund || {};
      const foretagData = jsonData.dataJson?.foretag || {};
      
      const updatedData = {
        ...data,
        // Grundläggande kunduppgifter
        companyName: kundData.namn || foretagData.namn || data.companyName,
        contactPerson: kundData.kontaktperson || data.contactPerson,
        phone: kundData.telefon || foretagData.telefon || data.phone,
        email: kundData.epost || foretagData.epost || data.email,
        address: kundData.adress || foretagData.adress || data.address,
        zip: kundData.postnummer || data.zip,
        city: kundData.ort || data.city,
        orgNr: kundData.orgnr || foretagData.orgnr || data.orgNr,
        contactDate: kundData.datum || data.contactDate,
        // Offertspecifika fält
        title: jsonData.title || data.title,
        amount: jsonData.amount || data.amount,
        currency: jsonData.currency || data.currency,
        totalSum: jsonData.totalSum || data.totalSum,
        vatPercent: jsonData.vatPercent || data.vatPercent,
        vatAmount: jsonData.vatAmount || data.vatAmount,
        validityDays: jsonData.validityDays || data.validityDays,
        // Ytterligare fält från kunddata
        customerNumber: kundData.offertnummer || data.customerNumber,
        position: kundData.befattning || data.position,
        country: kundData.land || data.country || "Sverige"
      };

      persistData(updatedData);

      // 5. Plocka ut textdelen (allt efter JSON)
      const textStart = gptReply.indexOf(jsonMatch[0]) + jsonMatch[0].length;
      const rawTextData = gptReply.substring(textStart).trim();
      
      // 6. Rensa textdelen från box-drawing-tecken
      const cleanTextData = cleanOfferText(rawTextData);
      
      // 7. Spara textdelen i state för förhandsvisning (aldrig JSON i UI)
      setGptOfferPreview(cleanTextData);

      // 8. Spara i Supabase documents-tabellen
      const response = await fetch('/api/documents/create-from-gpt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: routeCustomerId, // Tvinga route ID
          jsonData: jsonData,
          textData: cleanTextData,
          documentType: jsonData.documentType || 'offert'
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
      const response = await fetch(`/api/documents/list?customerId=${routeCustomerId}`);
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
          customerId: routeCustomerId
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
          customerId: routeCustomerId
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
          customerId: routeCustomerId
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

  // PDF-textutvinning och parser borttagen: ingen autofyll från PDF längre

  // === Nollställ kundkortet (när offerten raderas) ===
  function resetCustomerCard() {
    const nyttKundnummer = `K-${Math.floor(100000 + Math.random() * 900000)}`;
    const tomData = {
      companyName: "",
      orgNr: "",
      contactPerson: "",
      role: "",
      position: "",
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
      title: "",
      amount: "",
      currency: "SEK",
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

      // 5) Tidigare: autofyll via OCR/PDF-textutvinning. Nu borttagen.
      if (type === "offert") {
        // TODO: Här fanns OCR/PDF-parsing. Lägg ev. ny GPT-baserad lösning senare.
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
        <CustomerCardInfo customerId={routeCustomerId} />
      </section>

      {/* Dokumentöversikt – liknande bokföringsprogram */}
      <section id="dokument" className="mt-3 mb-6">
        <h2 className="text-lg font-semibold mb-2 text-gray-800">Dokumentöversikt</h2>
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <DocumentOverview customerId={routeCustomerId} />
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
            customerId={routeCustomerId} 
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
      <OfferRealtime customerId={routeCustomerId} />

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
                <a 
                  href={getCustomerCardUrl()}
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                >
                  ➡️ Öppna kundkortet
                </a>
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
