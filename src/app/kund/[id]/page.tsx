"use client";

import OfferPanel from "./OfferPanel";
import DocsCard from "@/components/DocsCard";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import React, { useEffect, useRef, useState } from "react";
import LogoutButton from "@/components/LogoutButton";
import OfferList from "@/components/OfferList";
import OfferRealtime from "./OfferRealtime";
import { CheckCircle, XCircle, Send, FilePlus, FileText } from "lucide-react";
import {
  defaultFlow,
  FlowStatus,
  loadFlowStatus,
  upsertFlowStatus,
} from "@/lib/flowStatus";
import { supabase } from "@/lib/supabaseClient";
import { BUCKET_DOCS, OFFER_BUCKET } from "@/lib/storage";

type DocFile = { name: string; url: string };
type BkFile = { name: string; url: string; type: "image" | "pdf" };
type CustomerDocument = {
  id: string;
  doc_type?: string | null;
  type?: string | null;
  filename?: string | null;
  created_at?: string | null;
  file_url?: string | null;
  pdf_url?: string | null;
  url?: string | null;
};

declare global {
  interface Window {
    pdfjsLib?: any;
  }
}

const isMobile =
  typeof navigator !== "undefined" &&
  /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

/* ==================================
   IndexedDB Database helper functions
   ==================================== */
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

/* ====================================
   Mobile detection helper functions
   ==================================== */
function isMobileDevice() {
  return (
    typeof navigator !== "undefined" &&
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
  );
}

/* =======================
   Flow Status Hook
   ======================= */

function useFlowStatusSupabase(customerId: string) {
  const [status, setStatus] = React.useState<FlowStatus>(defaultFlow);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let ok = true;
    (async () => {
      try {
        const s = await loadFlowStatus(customerId);
        if (ok) setStatus(s);
      } finally {
        if (ok) setLoading(false);
      }
    })();
    return () => {
      ok = false;
    };
  }, [customerId]);

  const save = React.useCallback(
    async (patch: Partial<FlowStatus>) => {
      const s = await upsertFlowStatus(customerId, patch);
      setStatus(s);
    },
    [customerId]
  );

  return { status, save, loading };
}

// Liten väntare för demo innan riktiga API-anrop kopplas på
const fakeWait = (ms = 500) => new Promise((r) => setTimeout(r, ms));

/* =======================
   React Components
   ======================= */

function SectionCard({
  title,
  children,
  right,
}: {
  title: string;
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <section className="bg-white border rounded-2xl shadow-sm p-4 md:p-6">
      <div className="flex items-start justify-between mb-4">
        <h3 className="text-lg font-semibold">{title}</h3>
        {right}
      </div>
      {children}
    </section>
  );
}

export default function KundDetaljsida() {
  const params = useParams();
  const router = useRouter();

  const customerId = String((params as { id?: string })?.id ?? "");
  const id = customerId;



  // Flow status hook
  const { status, save } = useFlowStatusSupabase(customerId);

  // Handle creating order from offer
  const handleCreateOrder = async () => {
    setOrderLoading(true);
    try {
      // Försök hitta offerPath, men fortsätt även om ingen hittas
      const offerData = await ensureOfferPath();

      if (!offerData) {
        console.warn("[handleCreateOrder] No offer found, creating order without PDF");
      }

      const res = await fetch("/api/orders/create-from-offer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          customerId,
          offerPath: offerData?.path || undefined,
          bucket: BUCKET_DOCS,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();

      // Om order skapades med PDF, hämta och visa den
      if (json?.ok && json?.path && json?.bucket) {
        console.log("[handleCreateOrder] Order created with PDF:", json.path);

        const { data: file, error } = await supabase.storage
          .from(json.bucket)
          .download(json.path);

        if (error || !file) {
          console.error("[order] download failed", error?.message);
        } else {
          const pdfBlob =
            file.type === "application/pdf"
              ? file
              : new Blob([file], { type: "application/pdf" });

          console.log("[order] blob size,type =", pdfBlob.size, pdfBlob.type);
          const url = URL.createObjectURL(pdfBlob);
          setOrderPdfUrl((prev) => {
            if (prev) URL.revokeObjectURL(prev);
            return url;
          });
          (window as any)._lastOrderUrl = url;
          console.log("[order] blob url:", url);
        }
      } else if (json?.ok) {
        // Order skapades utan PDF
        console.log("[handleCreateOrder] Order created without PDF");
        alert("Order skapad! (Ingen PDF genererades eftersom offert saknas)");
      }

      await save({ orderCreated: true });
    } catch (e: any) {
      console.error(e);
      alert(`Kunde inte skapa order: ${e.message || e}`);
    } finally {
      setOrderLoading(false);
    }
  };

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
    validityDays: "",
  });

  const [images, setImages] = useState<{ name: string; url: string }[]>([]);
  const [offert, setOffert] = useState<DocFile | null>(null);
  const [order, setOrder] = useState<DocFile | null>(null);
  const [invoice, setInvoice] = useState<DocFile | null>(null);
  const [orderPdfUrl, setOrderPdfUrl] = useState<string | null>(null);
  const [orderLoading, setOrderLoading] = useState(false);
  const [offerPath, setOfferPath] = useState<string | null>(null);
  const [documents, setDocuments] = useState<CustomerDocument[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [docsError, setDocsError] = useState<string | null>(null);
  const [sentStatus, setSentStatus] = useState<{ [key: string]: string }>({
    offert: "",
    order: "",
    invoice: "",
  });

  // New flow documents
  const [flowDocuments, setFlowDocuments] = useState<{
    offers: any[];
    orders: any[];
    invoices: any[];
  }>({ offers: [], orders: [], invoices: [] });

  // Bokföring (bilder + PDF:er)
  const [bookkeepingFiles, setBookkeepingFiles] = useState<BkFile[]>([]);

  // Hålla koll på Blob-URL:er för att kunna revoke() på unmount
  const objectUrlsRef = useRef<string[]>([]);
  const offertCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const offertPagesRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // ============ LADDA KUNDDATA ============
    // Prioritet: 1) Supabase customers-tabellen, 2) localStorage

    async function loadCustomerData() {
      const getField = (row: any, keys: string[], fallback: string = "") => {
        if (!row) return fallback;
        for (const key of keys) {
          const value = row[key];
          if (value !== undefined && value !== null && value !== "") {
            return String(value);
          }
        }
        return fallback;
      };

      try {
        const { data: customerRow, error } = await supabase
          .from("customer_cards")
          .select("*")
          .eq("customer_id", customerId)
          .maybeSingle();

        console.log("[page.tsx] customerRow:", customerRow);
        console.log("[page.tsx] error:", error ?? null);

        if (!error && customerRow) {
          console.log("[page.tsx] ✅ Loaded customer from Supabase customer_cards:", customerRow);

          setData({
            companyName: customerRow.name || "",
            orgNr: customerRow.orgnr || "",
            contactPerson: "",
            role: "",
            phone: customerRow.phone || "",
            email: customerRow.email || "",
            address: customerRow.address || "",
            zip: "",
            city: "",
            country: "Sverige",
            contactDate: "",
            notes: "",
            customerNumber: "",
            offerText: "",
            totalSum: "",
            vatPercent: "",
            vatAmount: "",
            validityDays: ""
          });

          return;
        } else if (error) {
          console.warn("[page.tsx] Supabase fetch error:", error.message);
        }
      } catch (e) {
        console.warn("[page.tsx] Failed to load from Supabase:", e);
      }

      const existingCustomers = JSON.parse(
        localStorage.getItem("paperflow_customers_v1") || "[]"
      );
      const localCustomer = existingCustomers.find(
        (c: any) => String(c.id) === String(customerId)
      );

      if (localCustomer) {
        console.log("[page.tsx] Loaded customer from localStorage:", localCustomer);
        setData((prev) => ({
          ...prev,
          companyName: localCustomer.companyName || localCustomer.namn || prev.companyName,
          orgNr: localCustomer.orgNr || localCustomer.orgnr || prev.orgNr,
          contactPerson: localCustomer.contactPerson || localCustomer.kontaktperson || prev.contactPerson,
          phone: localCustomer.phone || localCustomer.telefon || prev.phone,
          email: localCustomer.email || localCustomer.epost || prev.email,
          address: localCustomer.address || localCustomer.adress || prev.address,
          zip: localCustomer.zip || localCustomer.postnummer || prev.zip,
          city: localCustomer.city || localCustomer.ort || prev.city,
          country: localCustomer.country || localCustomer.land || prev.country,
          customerNumber: localCustomer.customerNumber || localCustomer.offertnummer || prev.customerNumber
        }));
      }
    }

    loadCustomerData();

    const savedImages = localStorage.getItem(`kund_images_${customerId}`);
    if (savedImages) setImages(JSON.parse(savedImages));

    const savedOffertMeta = localStorage.getItem(`kund_offert_${customerId}`);
    const savedOrderMeta = localStorage.getItem(`kund_order_${customerId}`);
    const savedInvoiceMeta = localStorage.getItem(`kund_invoice_${customerId}`);

    async function restoreDoc(
      type: "offert" | "order" | "invoice",
      metaStr: string | null
    ) {
      const key = `${type}_${customerId}`;

      // 1) Försök hämta från IndexedDB först
      const blob = await idbGet(key);
      if (blob) {
        const name = metaStr
          ? (JSON.parse(metaStr).name as string)
          : `${type}.pdf`;
        const url = URL.createObjectURL(blob);
        objectUrlsRef.current.push(url);
        const file = { name, url };
        if (type === "offert") setOffert(file);
        if (type === "order") setOrder(file);
        if (type === "invoice") setInvoice(file);
        return;
      }

      // 2) Fallback: hämta senaste från Supabase documents
      try {
        const { data: docs, error } = await supabase
          .from("documents")
          .select("*")
          .eq("customer_id", customerId)
          .eq("doc_type", type)
          .order("created_at", { ascending: false })
          .limit(1);

        if (error || !docs?.length) return;

        const doc = docs[0];
        const { data: file, error: dlError } = await supabase.storage
          .from(doc.bucket || "paperflow-files")
          .download(doc.storage_path);

        if (dlError || !file) return;

        const pdfBlob =
          file.type === "application/pdf"
            ? file
            : new Blob([file], { type: "application/pdf" });

        await idbSet(key, pdfBlob);

        const name = doc.filename || `${type}.pdf`;
        const url = URL.createObjectURL(pdfBlob);
        objectUrlsRef.current.push(url);
        const fileObj = { name, url };

        if (type === "offert") setOffert(fileObj);
        if (type === "order") setOrder(fileObj);
        if (type === "invoice") setInvoice(fileObj);
      } catch (e) {
        console.warn(`[restoreDoc] Failed to restore ${type} from Supabase:`, e);
      }
    }

    Promise.resolve()
      .then(() => restoreDoc("offert", savedOffertMeta))
      .then(() => restoreDoc("order", savedOrderMeta))
      .then(() => restoreDoc("invoice", savedInvoiceMeta))
      .catch(() => { });

    const savedStatus = localStorage.getItem(`kund_sent_${customerId}`);
    if (savedStatus) setSentStatus(JSON.parse(savedStatus));

    const savedBk = localStorage.getItem(`kund_bookkeeping_${customerId}`);
    if (savedBk) setBookkeepingFiles(JSON.parse(savedBk));

    return () => {
      objectUrlsRef.current.forEach((u) => URL.revokeObjectURL(u));
      objectUrlsRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId]);

  useEffect(() => {
    if (!isMobile || !offert?.url || !offertPagesRef.current) return;

    let raf = 0;
    const draw = () => {
      raf = requestAnimationFrame(() => {
        renderPdfToContainer(offert.url, offertPagesRef.current!).catch(
          console.warn
        );
      });
    };

    draw();
    const onResize = () => draw();
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, [isMobile, offert?.url]);

  // Load flow documents
  useEffect(() => {
    const loadFlowDocuments = async () => {
      try {
        const response = await fetch(`/api/customers/${customerId}/documents`);
        if (response.ok) {
          const documents = await response.json();
          setFlowDocuments(documents);
        }
      } catch (error) {
        console.warn("Failed to load flow documents:", error);
      }
    };

    if (customerId) {
      loadFlowDocuments();
    }
  }, [customerId]);

  // Fallback vid mount (om offerten redan fanns)
  useEffect(() => {
    (async () => {
      if (offerPath || !customerId) return;
      const { data: doc } = await supabase
        .from("documents")
        .select("storage_path")
        .eq("customer_id", customerId)
        .in("type", ["offer", "offert"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (doc?.storage_path) setOfferPath(doc.storage_path);
    })();
  }, [offerPath, customerId]);

  // Helper som försöker hitta offerPath, returnerar null om ingen hittas
  async function ensureOfferPath(): Promise<{ bucket: string; path: string } | null> {
    const el = document.querySelector('[data-testid="offer-preview"]');
    const pathAttr = el?.getAttribute("data-offer-path") || null;

    const path = offerPath ?? pathAttr;
    if (path) return { bucket: BUCKET_DOCS, path };

    // Försök hitta dokument - kolla både type och doc_type fält
    const { data: docs } = await supabase
      .from("documents")
      .select("storage_path, type, doc_type")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false });

    // Hitta första dokumentet som är en offert (kolla både type och doc_type)
    const doc = docs?.find(d => {
      const docType = d.type || d.doc_type || "";
      return docType === "offer" || docType === "offert";
    });

    if (doc?.storage_path) {
      setOfferPath(doc.storage_path);
      (el as HTMLElement | null)?.setAttribute(
        "data-offer-path",
        doc.storage_path
      );
      return { bucket: BUCKET_DOCS, path: doc.storage_path };
    }

    // Om ingen hittades i Supabase men vi har en lokal offert, ladda upp den först
    if (offert?.url) {
      try {
        // Hämta blob från IndexedDB
        const key = `offert_${customerId}`;
        const blob = await idbGet(key);

        if (blob) {
          console.log("[ensureOfferPath] Uploading local offer to Supabase...");
          const timestamp = Date.now();
          const fileName = `offers/${customerId}/${timestamp}-${offert.name}`;

          const { data: uploadData, error: uploadError } = await supabase.storage
            .from(BUCKET_DOCS)
            .upload(fileName, blob, { upsert: true });

          if (uploadError) {
            console.error("Failed to upload offer:", uploadError);
            return null;
          }

          // Spara i documents-tabellen
          const { error: docError } = await supabase.from("documents").insert({
            customer_id: customerId,
            type: "offer",
            storage_path: uploadData.path,
            filename: offert.name,
            created_at: new Date().toISOString(),
          });

          if (docError) {
            console.error("Failed to save document record:", docError);
          }

          setOfferPath(uploadData.path);
          return { bucket: BUCKET_DOCS, path: uploadData.path };
        }
      } catch (err) {
        console.error("[ensureOfferPath] Error uploading local offer:", err);
      }
    }

    console.warn("[ensureOfferPath] No offer found for customer:", customerId);
    return null;
  }

  function persistData(updated: typeof data) {
    const existingCustomers = JSON.parse(
      localStorage.getItem("paperflow_customers_v1") || "[]"
    );
    const customerIndex = existingCustomers.findIndex(
      (c: any) => String(c.id) === String(customerId)
    );

    if (customerIndex !== -1) {
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
        offerText: updated.offerText,
        totalSum: updated.totalSum,
        vatPercent: updated.vatPercent,
        vatAmount: updated.vatAmount,
        validityDays: updated.validityDays,
      };
      localStorage.setItem(
        "paperflow_customers_v1",
        JSON.stringify(existingCustomers)
      );
    } else {
      localStorage.setItem(`kund_${customerId}`, JSON.stringify(updated));
    }

    setData(updated);
  }

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) {
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
          localStorage.setItem(`kund_images_${customerId}`, JSON.stringify(updated));
          return updated;
        });
      };
      reader.readAsDataURL(file);
    });
  }

  function deleteImage(index: number) {
    setImages((prev) => {
      const updated = [...prev.slice(0, index), ...prev.slice(index + 1)];
      localStorage.setItem(`kund_images_${customerId}`, JSON.stringify(updated));
      return updated;
    });
  }

  // === Load PDF.js (via CDN) exactly once ===
  async function loadPdfJsOnce(): Promise<any> {
    if (window.pdfjsLib) return window.pdfjsLib;

    await new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Kunde inte ladda PDF.js"));
      document.head.appendChild(script);
    });

    const pdfjsLib = window.pdfjsLib!;
    try {
      if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
        pdfjsLib.GlobalWorkerOptions.workerSrc =
          "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
      }
    } catch { }
    return pdfjsLib;
  }

  async function renderPdfToContainer(url: string, container: HTMLDivElement) {
    const pdfjsLib = await loadPdfJsOnce();

    container.innerHTML = "";

    const measureWidth = () => {
      const r = container.getBoundingClientRect();
      if (r.width > 0) return Math.floor(r.width);
      if (container.parentElement) {
        const pr = container.parentElement.getBoundingClientRect();
        if (pr.width > 0) return Math.floor(pr.width);
      }
      return Math.floor(window.innerWidth || 360);
    };

    await new Promise((res) =>
      requestAnimationFrame(() => requestAnimationFrame(res as any))
    );

    const cssWidth = measureWidth();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    let doc: any;
    try {
      doc = await pdfjsLib.getDocument({ url }).promise;
    } catch {
      const ab = await (await fetch(url)).arrayBuffer();
      doc = await pdfjsLib.getDocument({ data: ab }).promise;
    }

    for (let p = 1; p <= doc.numPages; p++) {
      try {
        const page = await doc.getPage(p);
        const base = page.getViewport({ scale: 1 });
        const scale = (cssWidth * dpr) / base.width;
        const vp = page.getViewport({ scale });

        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d")!;

        canvas.width = Math.ceil(vp.width);
        canvas.height = Math.ceil(vp.height);

        canvas.style.width = cssWidth + "px";
        canvas.style.height = Math.ceil(vp.height / dpr) + "px";
        canvas.className = "mb-3 rounded border bg-white";

        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        await page.render({ canvasContext: ctx, viewport: vp }).promise;
        container.appendChild(canvas);

        await new Promise((resolve) => {
          if (typeof window.requestIdleCallback === "function") {
            window.requestIdleCallback(resolve);
          } else {
            setTimeout(resolve, 0);
          }
        });
      } catch (e) {
        console.warn("Render fail p", p, e);
      }
    }
  }

  async function renderPdfToCanvas(url: string, canvas: HTMLCanvasElement) {
    const pdfjsLib = await loadPdfJsOnce();
    const ab = await (await fetch(url)).arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: ab }).promise;

    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const cssWidth = canvas.clientWidth || 360;

    const pages = [];
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      pages.push(await pdf.getPage(pageNum));
    }

    const pageData = [];
    let totalHeight = 0;
    let maxWidth = 0;

    for (const page of pages) {
      const pageBase = page.getViewport({ scale: 1 });
      const pageScale = (cssWidth * dpr) / pageBase.width;
      const pageVp = page.getViewport({ scale: pageScale });

      pageData.push({
        page,
        viewport: pageVp,
        width: Math.ceil(pageVp.width),
        height: Math.ceil(pageVp.height),
        yOffset: totalHeight,
      });

      totalHeight += Math.ceil(pageVp.height);
      maxWidth = Math.max(maxWidth, Math.ceil(pageVp.width));
    }

    canvas.width = maxWidth;
    canvas.height = totalHeight;

    canvas.style.width = cssWidth + "px";
    canvas.style.height = Math.ceil(totalHeight / dpr) + "px";

    const ctx = canvas.getContext("2d")!;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (const pageInfo of pageData) {
      await pageInfo.page
        .render({
          canvasContext: ctx,
          viewport: pageInfo.viewport,
          transform: [1, 0, 0, 1, 0, pageInfo.yOffset],
        })
        .promise;
    }
  }

  // === Extract text from PDF (all pages) ===
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

  // === Parser (safe, null-guarded) ===
  function parseFieldsFromText(txt: string, filename?: string) {
    try {
      const norm = normalize(txt || "");
      const safeGet = (regex: RegExp) => {
        const m = norm.match(regex);
        return m && m[1] ? String(m[1]).trim() : "";
      };

      const kund = safeGet(
        /(?:Kund|Beställare|Företag|Kundnamn)\s*:?\s*(.+)/i
      );
      const datum = safeGet(
        /(?:Datum|Offertdatum)\s*:?\s*([0-9]{4}-[0-9]{2}-[0-9]{2}|[0-9]{2}[-/.][0-9]{2}[-/.][0-9]{2,4})/i
      );
      let offertnr = safeGet(
        /(?:Offert(?:nummer|\s*nr\.?)?|Offert-Nr\.?)\s*:?\s*([A-Za-z0-9\-_/]+)/i
      );

      const orgnr =
        safeGet(
          /(?:Org(?:\.|\s)?(?:nr|nummer)|Organisations(?:nummer|nr))\s*:?\s*([0-9\- ]{6,})/i
        ) ||
        safeGet(
          /(?:VAT|Momsregnr|VAT(?:\s*nr)?)\s*:?\s*([A-Za-z0-9\- ]{6,})/i
        );

      let adress =
        safeGet(/(?:Adress|Gatuadress|Besöksadress)\s*:?\s*(.+)/i) ||
        safeGet(/(?:Postadress)\s*:?\s*(.+)/i);

      const postrad = (() => {
        const a = norm.match(
          /(?:Postnr(?:\.|)|Postnummer|Postadress)\s*:?\s*([0-9]{3}\s?[0-9]{2}\s+[^\n]+)/i
        );
        if (a && a[1]) return a[1];
        const b = norm.match(
          /([0-9]{3}\s?[0-9]{2})\s+([A-Za-zÅÄÖåäö\- ]{2,})/
        );
        if (b && b[0]) return b[0];
        return "";
      })();

      const telefon = safeGet(
        /(?:Telefon|Tel\.?|Tel)\s*:?\s*([\d +\-()]{5,})/i
      );
      const email = safeGet(
        /(?:E-?post|E ?post|E-mail|Mail)\s*:?\s*([^\s,;<>]+@[^\s,;<>]+)/i
      );
      const kontaktperson = safeGet(
        /(?:Kontaktperson|Kontakt)\s*:?\s*([^\n]+)/i
      );
      const land = safeGet(/(?:Land|Country)\s*:?\s*([^\n]+)/i);

      let street = adress || "";
      let zip = "";
      let city = "";

      if (adress) {
        const parts = adress
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        if (parts.length >= 2) {
          street = parts[0];
          const tail = parts.slice(1).join(", ");
          const m = tail.match(/(\d{3}\s?[0-9]{2})\s+(.+)/);
          if (m && m[1] && m[2]) {
            zip = formatZip(m[1]);
            city = String(m[2]).trim();
          } else if (!city) {
            city = tail;
          }
        }
      }

      if ((!zip || !city) && postrad) {
        const m2 = postrad.match(/(\d{3}\s?[0-9]{2})\s+(.+)/);
        if (m2 && m2[1] && m2[2]) {
          zip = formatZip(m2[1]);
          city = String(m2[2]).trim();
        }
      }

      let companyGuess = kund || "";
      if (!companyGuess) {
        const firstLines = norm
          .split("\n")
          .slice(0, 12)
          .map((s) => s.trim())
          .filter(Boolean);
        const stopIdx = firstLines.findIndex((l) =>
          /offert|order|faktura/i.test(l)
        );
        const scope = stopIdx > 0 ? firstLines.slice(0, stopIdx) : firstLines;
        const cand = scope.find(
          (l) =>
            /[A-Za-zÅÄÖåäö]/.test(l) &&
            l.split(" ").length >= 2 &&
            l.length <= 60
        );
        if (cand) companyGuess = cand.replace(/^(AB|HB|KB)\s+/i, "").trim();
      }

      if (!offertnr && filename) {
        const m = filename.match(
          /(offert|offer|off)\s*[-_ ]?\s*([A-Za-z0-9\-_/]+)/i
        );
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
      offerText: "",
      totalSum: "",
      vatPercent: "",
      vatAmount: "",
      validityDays: "",
    };
    localStorage.setItem(`kund_${customerId}`, JSON.stringify(tomData));
    setData(tomData);

    const newStatus = { ...sentStatus, offert: "" };
    setSentStatus(newStatus);
    localStorage.setItem(`kund_sent_${customerId}`, JSON.stringify(newStatus));
  }

  // === Uppladdning (IndexedDB + Supabase Storage + säker reset av input) ===
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
      const key = `${type}_${customerId}`;
      await idbSet(key, uploaded);

      // 2) Skapa objectURL för visning nu
      const url = URL.createObjectURL(uploaded);
      objectUrlsRef.current.push(url);

      // 3) Spara ENDAST filnamnet i localStorage
      const meta = { name: uploaded.name };
      localStorage.setItem(`kund_${type}_${customerId}`, JSON.stringify(meta));

      // 4) Upload to Supabase Storage for offerts
      if (type === "offert") {
        const timestamp = Date.now();
        const fileName = `offers/${customerId}/${timestamp}-${uploaded.name}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from(BUCKET_DOCS)
          .upload(fileName, uploaded, { upsert: true });

        if (uploadError) {
          console.error("Supabase upload error:", uploadError);
        } else {
          // Save storage path and create preview URL
          setOfferPath(uploadData.path);

          // Update the offer state with blob URL
          const { data: pdfBlob, error } = await supabase.storage
            .from(BUCKET_DOCS)
            .download(uploadData.path);
          if (!error && pdfBlob) {
            const url = URL.createObjectURL(pdfBlob);
            const newFile = { name: uploaded.name, url };
            setOffert(newFile);
          }

          // Save document record in database
          const { error: docError } = await supabase.from("documents").insert({
            customer_id: customerId,
            type: "offer",
            storage_path: uploadData.path,
            filename: uploaded.name,
            created_at: new Date().toISOString(),
          });

          if (docError) {
            console.error("Documents table insert error:", docError);
          } else {
            console.log("Offer saved to Supabase:", uploadData.path);
          }

          // 6) Autofyll vid offert (server-parse, fallback local)
          try {
            const resp = await fetch("/api/offers/parse", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({
                bucket: BUCKET_DOCS,
                path: uploadData.path,
              }),
            });

            if (resp.ok) {
              const json = await resp.json();

              // Merge customer info + offer metadata + totals
              const offerData = {
                ...json.parsed.customer,
                // Offertinformation
                customerNumber: json.parsed.metadata?.offerNumber || data.customerNumber,
                contactDate: json.parsed.metadata?.date || data.contactDate,
                validityDays: json.parsed.metadata?.validity || data.validityDays,
                // Finansiell information
                totalSum: json.parsed.totals?.net?.toString() || data.totalSum,
                vatPercent: json.parsed.totals?.vat?.toString() || data.vatPercent,
                vatAmount: json.parsed.totals?.gross?.toString() || data.vatAmount,
              };

              const updated = { ...data, ...offerData };
              setData(updated);
              persistData(updated);

              // Uppdatera customer i databasen (bara kunduppgifter, inte offer-data)
              const { error: updateError } = await supabase
                .from("customers")
                .update(json.parsed.customer)
                .eq("id", customerId);

              if (updateError) {
                console.error("Customer update error:", updateError);
              } else {
                console.log("✅ Autofyllda fält från server:", offerData);
              }
            } else {
              const errorText = await resp.text();
              console.warn("Parse API failed:", errorText);
              const text = await extractTextFromPDF(uploaded);
              if (text && text.trim().length > 0) {
                const mapped = parseFieldsFromText(text, uploaded.name);
                const updated = { ...data, ...mapped };
                persistData(updated);
                console.log("Autofyllda fält (fallback):", mapped);
              }
            }
          } catch (parseError) {
            console.error("Parse error:", parseError);
            const text = await extractTextFromPDF(uploaded);
            if (text && text.trim().length > 0) {
              const mapped = parseFieldsFromText(text, uploaded.name);
              const updated = { ...data, ...mapped };
              persistData(updated);
              console.log("Autofyllda fält (fallback):", mapped);
            }
          }
        }
      }

      // 5) Uppdatera state (order/faktura)
      if (type !== "offert") {
        const newFile = { name: uploaded.name, url };
        if (type === "order") setOrder(newFile);
        if (type === "invoice") setInvoice(newFile);

        if (type === "invoice") {
          try {
            const fileName = `${Date.now()}-faktura.pdf`;
            const storagePath = `invoices/${customerId}/${fileName}`;
            await supabase.from("documents").insert({
              customer_id: customerId,
              doc_type: "invoice",
              storage_path: storagePath,
              filename: fileName,
              bucket: "paperflow-files",
              created_at: new Date().toISOString(),
            });
            console.log(
              "[handleSpecialUpload] saved invoice to documents table"
            );
          } catch (docErr) {
            console.warn(
              "[handleSpecialUpload] documents insert failed:",
              docErr
            );
          }
        }
      }
    } finally {
      inputEl.value = "";
    }
  }

  async function skickaEpost(pdfUrl: string, typ: string) {
    if (!data.email || data.email.trim() === "") {
      alert("Fyll i kundens e-postadress innan du skickar.");
      return;
    }

    const subject = `Här kommer din ${typ} från ${data.companyName || "oss"
      }`;
    const text = `Hej ${data.contactPerson || "kund"
      },\n\nHär kommer din ${typ}.\n\nLänk: ${pdfUrl}`;

    await fetch("/api/sendEmail", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: data.email, subject, text }),
    });

    const now = new Date().toLocaleDateString("sv-SE", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });

    const newStatus = { ...sentStatus, [typ]: now };
    setSentStatus(newStatus);
    localStorage.setItem(`kund_sent_${customerId}`, JSON.stringify(newStatus));

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
        const type: "image" | "pdf" = file.type.startsWith("image/")
          ? "image"
          : "pdf";
        const entry: BkFile = { name: file.name, url: result, type };
        setBookkeepingFiles((prev) => {
          const updated = [...prev, entry];
          localStorage.setItem(
            `kund_bookkeeping_${customerId}`,
            JSON.stringify(updated)
          );
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
      localStorage.setItem(`kund_bookkeeping_${customerId}`, JSON.stringify(updated));
      return updated;
    });
  }

  // Flow operations
  async function createOfferFromForm() {
    try {
      const response = await fetch(
        `/api/customers/${customerId}/offers/create-from-form`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        }
      );

      const result = await response.json();
      if (result.ok) {
        window.location.reload();
      } else {
        alert("Kunde inte skapa offert: " + (result.error || "Okänt fel"));
      }
    } catch (error) {
      alert("Kunde inte skapa offert: " + error);
    }
  }

  async function sendOffer(offerId: string) {
    try {
      const response = await fetch(`/api/offers/${offerId}/send`, {
        method: "POST",
      });

      const result = await response.json();
      if (result.ok) {
        window.location.reload();
      } else {
        alert("Kunde inte skicka offert: " + (result.error || "Okänt fel"));
      }
    } catch (error) {
      alert("Kunde inte skicka offert: " + error);
    }
  }

  async function offerToOrder(offerId: string) {
    try {
      const response = await fetch(`/api/offers/${offerId}/to-order`, {
        method: "POST",
      });

      const result = await response.json();
      if (result.ok) {
        window.location.reload();
      } else {
        alert("Kunde inte skapa order: " + (result.error || "Okänt fel"));
      }
    } catch (error) {
      alert("Kunde inte skapa order: " + error);
    }
  }

  async function orderToInvoice(orderId: string) {
    try {
      const response = await fetch(`/api/orders/${orderId}/to-invoice`, {
        method: "POST",
      });

      const result = await response.json();
      if (result.ok) {
        window.location.reload();
      } else {
        alert("Kunde inte skapa faktura: " + (result.error || "Okänt fel"));
      }
    } catch (error) {
      alert("Kunde inte skapa faktura: " + error);
    }
  }

  async function sendInvoice(invoiceId: string) {
    try {
      const response = await fetch(`/api/invoices/${invoiceId}/send`, {
        method: "POST",
      });

      const result = await response.json();
      if (result.ok) {
        window.location.reload();
      } else {
        alert("Kunde inte skicka faktura: " + (result.error || "Okänt fel"));
      }
    } catch (error) {
      alert("Kunde inte skicka faktura: " + error);
    }
  }

  async function invoiceToBookkeeping(invoiceId: string) {
    try {
      const response = await fetch(
        `/api/invoices/${invoiceId}/export-bookkeeping`,
        {
          method: "POST",
        }
      );

      const result = await response.json();
      if (result.ok) {
        window.location.reload();
      } else {
        alert(
          "Kunde inte exportera till bokföring: " +
          (result.error || "Okänt fel")
        );
      }
    } catch (error) {
      alert("Kunde inte exportera till bokföring: " + error);
    }
  }

  // Ta bort en huvud-PDF
  async function removeDoc(type: "offert" | "order" | "invoice") {
    const key = `${type}_${customerId}`;
    await idbDel(key);
    localStorage.removeItem(`kund_${type}_${customerId}`);

    if (type === "offert") setOffert(null);
    if (type === "order") setOrder(null);
    if (type === "invoice") setInvoice(null);
  }

  return (
    <div className="min-h-screen bg-white p-6 text-gray-800 max-w-6xl mx-auto">
      <LogoutButton />

      {/* Sticky toppbar */}
      <header className="sticky top-0 z-40 backdrop-blur bg-white/70 border-b mb-6">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <Link
              href="/dashboard"
              className="text-sm text-gray-600 hover:underline"
            >
              ← Tillbaka
            </Link>
            <div /> {/* spacer */}
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold">KUNDKORT</h1>
            <div className="text-xs text-gray-500">
              {data.companyName && <div>{data.companyName}</div>}
              <div>
                Kundnummer:{" "}
                <span className="inline-block bg-gray-100 px-2 py-0.5 rounded">
                  {data.customerNumber}
                </span>
              </div>
            </div>d
          </div>
        </div>
      </header>

     
      {/* Till bokföringen-knapp */}
      <div className="mb-4 flex gap-2 justify-between flex-wrap">
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

      {/* Kunduppgifter */}
      <SectionCard title="Kunduppgifter">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col">
            <label
              htmlFor="companyName"
              className="text-sm text-gray-600 mb-1"
            >
              Företagsnamn
            </label>
            <input
              id="companyName"
              name="companyName"
              value={data.companyName}
              onChange={handleChange}
              className="border p-2 rounded"
            />
          </div>

          <div className="flex flex-col">
            <label
              htmlFor="customerNumber"
              className="text-sm text-gray-600 mb-1"
            >
              Kundnummer (från Offertnummer)
            </label>
            <input
              id="customerNumber"
              name="customerNumber"
              value={data.customerNumber}
              onChange={handleChange}
              className="border p-2 rounded"
            />
          </div>

          <div className="flex flex-col">
            <label
              htmlFor="contactPerson"
              className="text-sm text-gray-600 mb-1"
            >
              Kontaktperson
            </label>
            <input
              id="contactPerson"
              name="contactPerson"
              value={data.contactPerson}
              onChange={handleChange}
              className="border p-2 rounded"
            />
          </div>

          <div className="flex flex-col">
            <label htmlFor="email" className="text-sm text-gray-600 mb-1">
              E-post
            </label>
            <input
              id="email"
              name="email"
              value={data.email}
              onChange={handleChange}
              className="border p-2 rounded"
            />
          </div>

          <div className="flex flex-col">
            <label htmlFor="phone" className="text-sm text-gray-600 mb-1">
              Telefon
            </label>
            <input
              id="phone"
              name="phone"
              value={data.phone}
              onChange={handleChange}
              className="border p-2 rounded"
            />
          </div>

          <div className="flex flex-col">
            <label htmlFor="address" className="text-sm text-gray-600 mb-1">
              Adress
            </label>
            <input
              id="address"
              name="address"
              value={data.address}
              onChange={handleChange}
              className="border p-2 rounded"
            />
          </div>

          <div className="flex flex-col">
            <label htmlFor="zip" className="text-sm text-gray-600 mb-1">
              Postnummer
            </label>
            <input
              id="zip"
              name="zip"
              value={data.zip}
              onChange={handleChange}
              className="border p-2 rounded"
            />
          </div>

          <div className="flex flex-col">
            <label htmlFor="city" className="text-sm text-gray-600 mb-1">
              Ort
            </label>
            <input
              id="city"
              name="city"
              value={data.city}
              onChange={handleChange}
              className="border p-2 rounded"
            />
          </div>

          <div className="flex flex-col">
            <label htmlFor="orgNr" className="text-sm text-gray-600 mb-1">
              Org.nr
            </label>
            <input
              id="orgNr"
              name="orgNr"
              value={data.orgNr}
              onChange={handleChange}
              className="border p-2 rounded"
            />
          </div>

          <div className="flex flex-col">
            <label
              htmlFor="contactDate"
              className="text-sm text-gray-600 mb-1"
            >
              Datum
            </label>
            <input
              id="contactDate"
              name="contactDate"
              type="date"
              value={data.contactDate}
              onChange={handleChange}
              className="border p-2 rounded"
            />
          </div>

          <div className="flex flex-col">
            <label htmlFor="role" className="text-sm text-gray-600 mb-1">
              Befattning
            </label>
            <input
              id="role"
              name="role"
              value={data.role}
              onChange={handleChange}
              className="border p-2 rounded"
            />
          </div>

          <div className="flex flex-col">
            <label htmlFor="country" className="text-sm text-gray-600 mb-1">
              Land
            </label>
            <input
              id="country"
              name="country"
              value={data.country}
              onChange={handleChange}
              className="border p-2 rounded"
            />
          </div>
        </div>
      </SectionCard>

      {/* Offertdata (om de finns) */}
      {(data.totalSum ||
        data.vatPercent ||
        data.vatAmount ||
        data.validityDays) && (
          <SectionCard title="💰 Offertdata">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {data.totalSum && (
                <div className="flex flex-col">
                  <label
                    htmlFor="totalSum"
                    className="text-sm text-gray-600 mb-1"
                  >
                    Totalsumma
                  </label>
                  <input
                    id="totalSum"
                    name="totalSum"
                    value={data.totalSum}
                    onChange={handleChange}
                    className="border p-2 rounded"
                  />
                </div>
              )}

              {data.vatPercent && (
                <div className="flex flex-col">
                  <label
                    htmlFor="vatPercent"
                    className="text-sm text-gray-600 mb-1"
                  >
                    Moms %
                  </label>
                  <input
                    id="vatPercent"
                    name="vatPercent"
                    value={data.vatPercent}
                    onChange={handleChange}
                    className="border p-2 rounded"
                  />
                </div>
              )}

              {data.vatAmount && (
                <div className="flex flex-col">
                  <label
                    htmlFor="vatAmount"
                    className="text-sm text-gray-600 mb-1"
                  >
                    Moms belopp
                  </label>
                  <input
                    id="vatAmount"
                    name="vatAmount"
                    value={data.vatAmount}
                    onChange={handleChange}
                    className="border p-2 rounded"
                  />
                </div>
              )}

              {data.validityDays && (
                <div className="flex flex-col">
                  <label
                    htmlFor="validityDays"
                    className="text-sm text-gray-600 mb-1"
                  >
                    Giltighet (dagar)
                  </label>
                  <input
                    id="validityDays"
                    name="validityDays"
                    value={data.validityDays}
                    onChange={handleChange}
                    className="border p-2 rounded"
                  />
                </div>
              )}
            </div>
          </SectionCard>
        )}

      {/* Dokumentflöde */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Offert Card – gammal variant (inaktiverad) */}
        {false && (
          <SectionCard
            title="🧾 Offert"
            right={
              <span
                className={`text-xs px-2 py-0.5 rounded-full ${sentStatus["offert"]
                    ? "bg-green-100 text-green-700"
                    : "bg-yellow-100 text-yellow-700"
                  }`}
              >
                {sentStatus["offert"]
                  ? `Skickad ${sentStatus["offert"]}`
                  : "Utkast"}
              </span>
            }
          >
            <input
              type="file"
              accept="application/pdf"
              onChange={(e) => handleSpecialUpload(e, "offert")}
              className="text-blue-700 font-semibold cursor-pointer mb-4 w-full"
            />
            {offert && (
              <div className="space-y-2">
                <div className="flex justify-between items-center gap-4">
                  <p className="text-sm text-blue-600">📎 {offert.name}</p>
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
                {isMobile ? (
                  <div ref={offertPagesRef} className="w-full" />
                ) : (
                  <iframe
                    src={offert.url + "#toolbar=0"}
                    className="w-full h-96 border rounded"
                    title="Offert PDF"
                    data-testid="offer-preview"
                    data-offer-path={offerPath ?? ""}
                    data-bucket={BUCKET_DOCS}
                  />
                )}
                <div
                  className="flex items-center gap-2"
                  data-testid="offer-actions"
                >
                  <button
                    type="button"
                    className="btn btn-primary flex items-center gap-1"
                    onClick={async () => {
                      alert("❌ Den här funktionen är borttagen.\n\nOffert skickas via GPT → PDF → plattformen.\nInga e-postutskick görs här längre.");
                    }}
                    title="Skicka offert"
                  >
                    <Send size={16} /> Skicka
                  </button>


                  {status.offerSent ? (
                    <span className="flex items-center gap-1 text-green-600">
                      <CheckCircle size={16} /> Skickad
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-red-600">
                      <XCircle size={16} /> Ej skickad
                    </span>
                  )}

                  <button
                    type="button"
                    className="btn btn-secondary flex items-center gap-1"
                    onClick={() => window.print()}
                  >
                    <FileText size={16} /> Skriv ut
                  </button>
                </div>
              </div>
            )}
          </SectionCard>
        )}

        {/* ✅ NY Offert-Panel VISAS HÄR ✅ */}
        <div className="mt-4">
          <OfferPanel customerId={customerId} />
        </div>

        {/* Orderbekräftelse – samma layout som Offert/Faktura */}
        <SectionCard
          title="📑 Orderbekräftelse"
          right={
            <span
              className={`text-xs px-2 py-0.5 rounded-full ${status.orderCreated
                  ? "bg-green-100 text-green-700"
                  : "bg-yellow-100 text-yellow-700"
                }`}
            >
              {status.orderCreated ? "Skapad" : "Utkast"}
            </span>
          }
        >
          {/* Samma typ av infotekst som Offert */}
          <p className="text-sm text-gray-600">
            Ingen orderbekräftelse skapad ännu.
          </p>

          <div className="mt-3 flex flex-col gap-2 text-sm">
            {/* Samma typ av knapp som Offert */}
            <button
              type="button"
              onClick={handleCreateOrder}
              disabled={orderLoading}
              className="w-full bg-black text-white py-2 rounded-full font-semibold hover:bg-gray-900 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {orderLoading ? "Skapar order..." : "Skapa order"}
            </button>

            {/* Historik-del – visuellt matchar Offert */}
            <div className="flex flex-col gap-0.5">
              <p className="text-xs font-semibold text-gray-600">
                Orderhistorik
              </p>
              <p className="text-xs text-gray-500">
                Inga orderbekräftelser ännu.
              </p>
              {/* Här kan du senare stoppa in en OrderList-komponent,
                  precis som OfferPanel, om du vill ha riktig historik */}
            </div>
          </div>
        </SectionCard>

        {/* Faktura Card */}
        <SectionCard
          title="💰 Faktura"
          right={
            <span
              className={`text-xs px-2 py-0.5 rounded-full ${sentStatus["invoice"]
                  ? "bg-green-100 text-green-700"
                  : "bg-yellow-100 text-yellow-700"
                }`}
            >
              {sentStatus["invoice"]
                ? `Skickad ${sentStatus["invoice"]}`
                : "Utkast"}
            </span>
          }
        >
          <input
            type="file"
            accept="application/pdf"
            onChange={(e) => handleSpecialUpload(e, "invoice")}
            className="text-blue-700 font-semibold cursor-pointer mb-4 w-full"
          />
          {invoice && (
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <p className="text-sm text-blue-600">📎 {invoice.name}</p>
                <button
                  onClick={async () => {
                    await removeDoc("invoice");
                  }}
                  className="text-red-600 text-sm font-semibold hover:underline"
                >
                  🗑️ Ta bort
                </button>
              </div>
              <iframe
                src={invoice.url}
                className="w-full h-64 border rounded"
                title="Faktura PDF"
              ></iframe>
            </div>
          )}

          {/* FAKTURA – knapprad */}
          <div
            className="flex flex-col gap-2 mt-2"
            data-testid="invoice-actions"
          >
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="btn btn-outline"
                onClick={async () => {
                  await fakeWait();
                  await save({ invoiceCreated: true });
                }}
                title="Skapa faktura"
              >
                Skapa faktura
              </button>

              <button
                type="button"
                className="btn btn-primary"
                onClick={async () => {
                  await fakeWait();
                  await fakeWait();
                  await save({ invoiceSent: true, invoicePosted: true });
                }}
                disabled={!status.invoiceCreated}
                title="Skicka faktura"
              >
                Skicka
              </button>

              {status.invoiceSent ? (
                <span className="text-green-600">✓ Skickad</span>
              ) : (
                <span className="text-red-600">✗ Ej skickad</span>
              )}
            </div>

            <div className="text-sm">
              {status.invoicePosted ? (
                <span className="text-green-600">
                  ✓ Skickad till bokföringen
                </span>
              ) : (
                <span className="text-gray-600">
                  ✗ Inte skickad till bokföringen
                </span>
              )}
            </div>
          </div>
        </SectionCard>
      </div>

      {/* Offerter */}
      <OfferRealtime customerId={String(id)} />
      <OfferList customerId={String(id)} />
      {/* Alla dokument för kunden */}
      <SectionCard title="📂 Alla dokument">
        {docsLoading && (
          <p className="text-sm text-gray-500">Laddar dokument...</p>
        )}

        {docsError && (
          <p className="text-sm text-red-600">{docsError}</p>
        )}

        {!docsLoading && !docsError && documents.length === 0 && (
          <p className="text-sm text-gray-500">Inga dokument sparade ännu.</p>
        )}

        {documents.length > 0 && (
          <ul className="divide-y border rounded">
            {documents.map((doc) => (
              <li
                key={doc.id}
                className="flex items-center justify-between px-3 py-2 text-sm"
              >
                <div className="flex flex-col">
                  <span className="font-medium">
                    {doc.doc_type || doc.type || "Dokument"}
                  </span>
                  <span className="text-gray-500">
                    {doc.filename || "—"}
                  </span>
                </div>

                {(doc.file_url || doc.pdf_url || doc.url) && (
                  <a
                    href={doc.file_url || doc.pdf_url || doc.url || "#"}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    Öppna
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      {/* Bilder och kladdlappar */}
      <SectionCard title="📷 Bilder och kladdlappar">
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={handleImageUpload}
          className="mt-2 mb-4 text-blue-700 font-semibold cursor-pointer"
        />
        <div className="grid grid-cols-2 gap-4">
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
      </SectionCard>

      {/* Bokföring */}
      <SectionCard title="📚 Bokföring">
        <p className="text-sm text-gray-700 mb-2">
          Ladda upp kvitton (bild) eller underlag (PDF). Allt sparas lokalt för
          kunden.
        </p>
        <input
          type="file"
          accept="image/*,application/pdf"
          multiple
          onChange={handleBookkeepingUpload}
          className="text-blue-700 font-semibold cursor-pointer mb-4"
        />
        <div className="grid grid-cols-2 gap-4">
          {bookkeepingFiles.map((f, idx) => (
            <div key={idx} className="border p-2 rounded shadow relative">
              {f.type === "image" ? (
                <img src={f.url} alt={f.name} className="w-full h-auto rounded" />
              ) : (
                <iframe
                  src={f.url}
                  className="w-full h-40 border rounded"
                  title={`Bokföring ${f.name}`}
                ></iframe>
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
      </SectionCard>

      {/* Offerttext (om den finns) */}
      {data.offerText && (
        <SectionCard title="📄 Offerttext från chatten">
          <div className="border p-4 rounded bg-gray-50">
            <pre className="whitespace-pre-wrap text-sm font-mono">
              {data.offerText}
            </pre>
          </div>
        </SectionCard>
      )}

      {/* Notes */}
      <SectionCard title="Anteckningar">
        <textarea
          name="notes"
          value={data.notes}
          onChange={handleChange}
          placeholder="Anteckningar..."
          rows={6}
          className="w-full border p-3 rounded"
        />
      </SectionCard>
    </div>
  );
}
