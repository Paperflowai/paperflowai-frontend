// src/app/bills/page.tsx
"use client";

import { useEffect, useState } from "react";
import PlusUploadMenu from "@/components/PlusUploadMenu";
import { createRemindersForBill, cancelRemindersForBill, snoozeReminder, getPendingReminders, getReminderMessage } from "@/lib/reminders";
import { requestNotificationPermission, setupNotificationHandlers, sendPushNotification } from "@/lib/notifications";
import { exportToSIE, exportToCSV, exportToExcel, downloadFile, generateWeeklySummary } from "@/lib/export";

export type Bill = {
  id: string;
  vendor: string;
  amountSEK: number;
  dueDate: string;     // yyyy-mm-dd
  paidAt?: string;     // ISO
  createdAt: string;   // ISO
  invoiceNumber?: string;
  originalFile?: string; // base64 or blob URL
};

function loadBills(): Bill[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem("pf_bills_v1") || "[]") as Bill[];
  } catch {
    return [];
  }
}

function saveBills(bills: Bill[]) {
  localStorage.setItem("pf_bills_v1", JSON.stringify(bills));
}

function daysUntil(dueDate: string) {
  const d = new Date(dueDate + "T00:00:00");
  const today = new Date();
  // nolla tid
  today.setHours(0, 0, 0, 0);
  const diffMs = d.getTime() - today.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

export default function BillsPage() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [vendor, setVendor] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingBill, setPendingBill] = useState<Partial<Bill> | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);

  useEffect(() => setBills(loadBills()), []);

  function addBill(e?: React.FormEvent) {
    e?.preventDefault();
    const amt = Number(amount.replace(",", "."));
    if (!vendor.trim() || !dueDate || !Number.isFinite(amt) || amt <= 0) return;
    
    // Check for duplicates
    if (invoiceNumber && bills.some(b => b.invoiceNumber === invoiceNumber)) {
      if (!confirm(`Fakturanummer ${invoiceNumber} finns redan. Lägg till ändå?`)) {
        return;
      }
    }
    
    const bill: Bill = {
      id: crypto.randomUUID(),
      vendor: vendor.trim(),
      amountSEK: Math.round(amt * 100) / 100,
      dueDate,
      invoiceNumber: invoiceNumber || undefined,
      createdAt: new Date().toISOString(),
    };
    
    // Show confirmation dialog
    setPendingBill(bill);
    setShowConfirmDialog(true);
  }
  
  function confirmBill() {
    if (!pendingBill) return;
    const next = [...bills, pendingBill as Bill];
    setBills(next);
    saveBills(next);
    setVendor("");
    setAmount("");
    setDueDate("");
    setInvoiceNumber("");
    setShowConfirmDialog(false);
    setPendingBill(null);
  }

  function markPaid(id: string) {
    const next = bills.map((b) => (b.id === id ? { ...b, paidAt: new Date().toISOString() } : b));
    setBills(next);
    saveBills(next);
  }

  function deleteBill(id: string) {
    const next = bills.filter((b) => b.id !== id);
    setBills(next);
    saveBills(next);
  }

  async function handleFileUpload(file: { name: string; type: "image" | "pdf"; blob?: Blob }) {
    if (!file.blob) return;
    
    try {
      // Skapa FormData för OCR-server
      const formData = new FormData();
      formData.append('file', file.blob, file.name);
      
      // Skicka till OCR-server
      const response = await fetch('/api/ocr', {
        method: 'POST',
        body: formData,
      });
      
      if (response.ok) {
        const data = await response.json();
        
        // Försök extrahera fakturadata från OCR-resultatet
        const text = data.text || '';
        
        // Förbättrad parsing för fakturor
        const amountMatch = text.match(/(\d{1,3}(?:\s?\d{3})*(?:[,\.]\d{2})?)\s*kr/i);
        const vendorMatch = text.match(/(?:från|faktura från|leverantör|avsändare)[:]\s*([^\n\r]{1,50})/i) || 
                           text.match(/([A-ZÅÄÖ][a-zåäö\s]+(?:AB|HB|KB|Aktiebolag|Handelsbolag))/);
        const invoiceNumberMatch = text.match(/(?:faktura|invoice|nr|nummer|#)[\s:]*(\d+)/i);
        const dueDateMatch = text.match(/(?:förfaller|due|betala senast|betalning)[\s:]*([\d\-\/\.]{8,10})/i);
        
        if (amountMatch) {
          const extractedAmount = amountMatch[1].replace(/\s/g, '').replace(',', '.');
          setAmount(extractedAmount);
        }
        
        if (vendorMatch) {
          setVendor(vendorMatch[1].trim());
        }
        
        if (invoiceNumberMatch) {
          setInvoiceNumber(invoiceNumberMatch[1]);
        }
        
        if (dueDateMatch) {
          // Parse datum i olika format
          const dateStr = dueDateMatch[1];
          const parsedDate = new Date(dateStr.replace(/\//g, '-'));
          if (!isNaN(parsedDate.getTime())) {
            setDueDate(parsedDate.toISOString().split('T')[0]);
          }
        } else {
          // Sätt förfallodatum till 30 dagar framåt som default
          const defaultDue = new Date();
          defaultDue.setDate(defaultDue.getDate() + 30);
          setDueDate(defaultDue.toISOString().split('T')[0]);
        }
        
      } else {
        console.error('OCR failed:', response.statusText);
        // Fallback: bara sätt filnamnet som leverantör
        setVendor(file.name.replace(/\.(pdf|jpg|jpeg|png)$/i, ''));
      }
    } catch (error) {
      console.error('Error processing file:', error);
      // Fallback: bara sätt filnamnet som leverantör
      setVendor(file.name.replace(/\.(pdf|jpg|jpeg|png)$/i, ''));
    }
  }

  const unpaid = bills.filter((b) => !b.paidAt);
  const nextDue = unpaid
    .map((b) => ({ b, du: daysUntil(b.dueDate) }))
    .sort((a, z) => a.du - z.du)[0];

  return (
    <div style={{ padding: "16px 0", marginTop: 80, fontFamily: "system-ui, sans-serif", maxWidth: "100vw", overflowX: "hidden" }}>
      <div style={{ padding: "0 12px" }}>
        <h1 style={{ fontSize: 22, marginBottom: 12 }}>Betalningspåminnare</h1>
      </div>

      <div style={{ padding: "0 12px" }}>
        {/* Liten påminnelsebanner */}
        {nextDue && (
          <div
            style={{
              padding: 12,
              borderRadius: 10,
              marginBottom: 16,
              background:
                nextDue.du < 0 ? "#fee2e2" : nextDue.du === 0 ? "#ffedd5" : "#ecfeff",
              border: "1px solid #e5e7eb",
            }}
          >
            <b>Nästa att betala:</b> {nextDue.b.vendor} — {nextDue.b.amountSEK.toFixed(2)} kr{" "}
            {nextDue.du < 0
              ? `(försenad ${Math.abs(nextDue.du)} dgr)`
              : nextDue.du === 0
              ? "(förfaller idag)"
              : `(om ${nextDue.du} dgr)`}
          </div>
        )}

        {/* Upload knapp */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
          <PlusUploadMenu 
            onAddNote={handleFileUpload}
            className="flex-shrink-0"
          />
        </div>

        {/* Lägg till faktura */}
        <form onSubmit={addBill} style={{ marginBottom: 20 }}>
          {/* Formulärfält - responsiva */}
          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr" }}>
            <input
              placeholder="Leverantör (t.ex. El-Grossisten AB)"
              value={vendor}
              onChange={(e) => setVendor(e.target.value)}
              style={{ padding: 12, borderRadius: 8, border: "1px solid #ddd", fontSize: 16 }}
            />
            <input
              placeholder="Fakturanummer (valfritt)"
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              style={{ padding: 12, borderRadius: 8, border: "1px solid #ddd", fontSize: 16 }}
            />
            <div style={{ display: "grid", gap: 8, gridTemplateColumns: "1fr 1fr" }}>
              <input
                placeholder="Belopp (kr)"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                style={{ padding: 12, borderRadius: 8, border: "1px solid #ddd", fontSize: 16 }}
              />
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                style={{ padding: 12, borderRadius: 8, border: "1px solid #ddd", fontSize: 16 }}
              />
            </div>
          </div>
        </form>
        
        <p style={{ fontSize: 12, color: "#6b7280", textAlign: "center", marginBottom: 16 }}>
          📸 Fota eller ladda upp PDF med +-knappen för automatisk ifyllning
        </p>
      </div>

      {/* Knapp utanför padding för perfekt centrering */}
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
        <button
          onClick={addBill}
          style={{
            padding: "12px 24px",
            borderRadius: 8,
            border: "1px solid #0ea5e9",
            background: "#0ea5e9",
            color: "white",
            fontSize: 16,
            fontWeight: 600,
            width: "280px",
          }}
        >
          Lägg till faktura
        </button>
      </div>

      <div style={{ padding: "0 12px" }}>
        {/* Lista: obetalda först */}
        <h2 style={{ fontSize: 16, margin: "8px 0" }}>Fakturor</h2>
      </div>
      <div style={{ padding: "0 12px" }}>
        <div style={{ display: "grid", gap: 8 }}>
          {[...unpaid, ...bills.filter((b) => b.paidAt)].map((b) => {
          const du = daysUntil(b.dueDate);
          const status = b.paidAt
            ? "Betald"
            : du < 0
            ? `Försenad ${Math.abs(du)} dgr`
            : du === 0
            ? "Förfaller idag"
            : `Om ${du} dgr`;

          const bg = b.paidAt ? "#ecfdf5" : du < 0 ? "#fee2e2" : du === 0 ? "#ffedd5" : "#f8fafc";

          return (
            <div
              key={b.id}
              style={{
                padding: 12,
                borderRadius: 10,
                border: "1px solid #e5e7eb",
                background: bg,
              }}
            >
              {/* Mobil: Stack vertikalt */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {/* Rad 1: Leverantör och belopp */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontWeight: 600, fontSize: 16, flex: 1, minWidth: 0 }}>
                    <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {b.vendor}
                    </div>
                  </div>
                  <div style={{ fontWeight: 600, fontSize: 16, color: "#059669" }}>
                    {b.amountSEK.toFixed(2)} kr
                  </div>
                </div>
                
                {/* Rad 2: Datum och status */}
                <div style={{ fontSize: 14, color: "#6b7280" }}>
                  {b.dueDate} • <span style={{ fontWeight: 600, color: du < 0 ? "#dc2626" : du === 0 ? "#ea580c" : "#059669" }}>{status}</span>
                </div>
                
                {/* Rad 3: Knappar */}
                <div style={{ display: "flex", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
                  {!b.paidAt && (
                    <button
                      onClick={() => markPaid(b.id)}
                      style={{
                        flex: 1,
                        padding: "10px 12px",
                        borderRadius: 8,
                        border: "1px solid #10b981",
                        background: "#10b981",
                        color: "white",
                        fontSize: 14,
                        fontWeight: 600,
                        minWidth: "120px"
                      }}
                    >
                      ✓ Markera betald
                    </button>
                  )}
                  <button
                    onClick={() => deleteBill(b.id)}
                    style={{
                      flex: b.paidAt ? 1 : 0,
                      padding: "10px 12px",
                      borderRadius: 8,
                      border: "1px solid #dc2626",
                      background: "#dc2626",
                      color: "white",
                      fontSize: 14,
                      fontWeight: 600,
                      minWidth: "100px"
                    }}
                  >
                    🗑️ Ta bort
                  </button>
                  {(() => {
                    const daysOverdue = Math.ceil((Date.now() - new Date(b.dueDate).getTime()) / (1000 * 60 * 60 * 24));
                    if (daysOverdue >= 30 && !b.paidAt) {
                      return (
                        <button
                          onClick={() => alert(`⚖️ KRONOFOGD-VARNING\n\nFaktura från ${b.vendor} är ${daysOverdue} dagar försenad.\nBelopp: ${b.amountSEK} kr\n\nDags att överväga kronofogdemyndigheten för indrivning.\n\nKontakta din juridiska rådgivare för nästa steg.`)}
                          style={{
                            flex: 0,
                            padding: "10px 12px",
                            borderRadius: 8,
                            border: "1px solid #ea580c",
                            background: "#ea580c",
                            color: "white",
                            fontSize: 14,
                            fontWeight: 600,
                            minWidth: "120px"
                          }}
                        >
                          ⚖️ Kronofogd
                        </button>
                      );
                    }
                    return null;
                  })()}
                </div>
              </div>
            </div>
          );
        })}
          {bills.length === 0 && (
            <div style={{ color: "#6b7280" }}>Inga fakturor ännu. Lägg till ovan.</div>
          )}
        </div>
      </div>

      {/* Bekräftelsedialog */}
      {showConfirmDialog && pendingBill && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0,0,0,0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000,
          padding: "16px"
        }}>
          <div style={{
            backgroundColor: "white",
            borderRadius: 12,
            padding: 24,
            maxWidth: "400px",
            width: "100%"
          }}>
            <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>
              Bekräfta faktura
            </h3>
            <div style={{ marginBottom: 20, lineHeight: 1.5 }}>
              <p><strong>Leverantör:</strong> {pendingBill.vendor}</p>
              <p><strong>Belopp:</strong> {pendingBill.amountSEK?.toFixed(2)} kr</p>
              <p><strong>Förfaller:</strong> {pendingBill.dueDate}</p>
              {pendingBill.invoiceNumber && (
                <p><strong>Fakturanummer:</strong> {pendingBill.invoiceNumber}</p>
              )}
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              <button
                onClick={() => {
                  setShowConfirmDialog(false);
                  setPendingBill(null);
                }}
                style={{
                  flex: 1,
                  padding: "12px 16px",
                  borderRadius: 8,
                  border: "1px solid #e5e7eb",
                  background: "white",
                  fontSize: 16
                }}
              >
                Avbryt
              </button>
              <button
                onClick={confirmBill}
                style={{
                  flex: 1,
                  padding: "12px 16px",
                  borderRadius: 8,
                  border: "1px solid #10b981",
                  background: "#10b981",
                  color: "white",
                  fontSize: 16,
                  fontWeight: 600
                }}
              >
                Bekräfta
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
