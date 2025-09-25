"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useApplyPatchedToCustomer } from "@/hooks/useApplyPatchedToCustomer";

type Doc = {
  id: string;
  table: "offers" | "orders" | "invoices";
  number?: string | null;
  date?: string | null;
  amount?: number | null;
  status?: string | null;
  url?: string | null;
};

const fmtMoney = (n: any) =>
  n == null ? "" : new Intl.NumberFormat("sv-SE", { style: "currency", currency: "SEK" }).format(Number(n));
const fmtDate = (s?: string | null) => (s ? new Date(s).toLocaleDateString() : "");

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "8px 12px",
        border: "1px solid #e5e7eb",
        borderBottom: active ? "2px solid #111827" : "1px solid #e5e7eb",
        borderRadius: "10px 10px 0 0",
        background: active ? "#fff" : "#f9fafb",
        cursor: "pointer",
        fontWeight: active ? 700 : 500,
      }}
    >
      {children}
    </button>
  );
}

function Modal({ open, onClose, url, title }: { open: boolean; onClose: () => void; url?: string | null; title?: string }) {
  if (!open) return null;
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 1000, display: "grid", placeItems: "center" }} onClick={onClose}>
      <div style={{ width: "90vw", height: "85vh", background: "#fff", borderRadius: 12, display: "grid", gridTemplateRows: "44px 1fr" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", padding: "0 12px", borderBottom: "1px solid #eee", gap: 8 }}>
          <strong style={{ flex: 1 }}>{title || "Dokument"}</strong>
          {url && <a href={url} target="_blank" rel="noreferrer" style={{ border: "1px solid #d1d5db", borderRadius: 8, padding: "6px 10px" }}>Öppna i ny flik</a>}
          <button onClick={onClose} style={{ border: "1px solid #ddd", borderRadius: 8, padding: "6px 10px", cursor: "pointer" }}>Stäng</button>
        </div>
        {url ? (
          <iframe src={url} style={{ width: "100%", height: "100%", border: "none" }} />
        ) : (
          <div style={{ padding: 16, color: "#6b7280" }}>Ingen visningslänk.</div>
        )}
      </div>
    </div>
  );
}

function StatusChip({ value }: { value?: string | null }) {
  const raw = String(value || "").toLowerCase().trim();
  const key = raw.replace(/^status[:\s-]*/,"").replace("-", " ").trim();
  const map: Record<string, { label: string; emoji: string; bg: string; fg: string }> = {
    "utkast":     { label: "Utkast",     emoji: "📝", bg: "#f3f4f6", fg: "#111827" },
    "ej skickad": { label: "Ej skickad", emoji: "✖",  bg: "#f1f5f9", fg: "#475569" },
    "skickad":    { label: "Skickad",    emoji: "⚠",  bg: "#fff7ed", fg: "#c2410c" },
    "accepterad": { label: "Accepterad", emoji: "✓",  bg: "#ecfdf5", fg: "#047857" },
    "klar":       { label: "Klar",       emoji: "✓",  bg: "#ecfdf5", fg: "#065f46" },
    "betald":     { label: "Betald",     emoji: "✓",  bg: "#eef2ff", fg: "#3730a3" },
    "makulerad":  { label: "Makulerad",  emoji: "–",  bg: "#f3f4f6", fg: "#6b7280" },
    "avslagen":   { label: "Avslagen",   emoji: "✖",  bg: "#fef2f2", fg: "#991b1b" },
    "imported":   { label: "Importerad", emoji: "⬆",  bg: "#eef2ff", fg: "#3730a3" },
  };
  const m = map[key] || (raw ? { label: value as string, emoji: "•", bg: "#f3f4f6", fg: "#374151" } : { label: "—", emoji: "", bg: "#fff", fg: "#6b7280" });
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:6, padding:"2px 8px",
                   borderRadius:999, border:"1px solid #e5e7eb", background:m.bg, color:m.fg, fontSize:12 }}>
      {m.emoji} {m.label}
    </span>
  );
}

function Table({
  rows,
  onView,
  onDelete,
  kind,
  isMobile,
  busyDelId,
}: {
  rows: Doc[];
  onView: (row: Doc) => void;
  onDelete: (row: Doc) => void;
  kind: "offers" | "orders" | "invoices";
  isMobile: boolean;
  busyDelId: string | null;
}) {
  const emptyMsg =
    kind === "offers" ? "Inga offerter ännu." : kind === "orders" ? "Inga order ännu." : "Inga fakturor ännu.";
  if (isMobile) {
    return (
      <div style={{ display: "grid", gap: 8 }}>
        {rows.length === 0 ? (
          <div style={{ color:"#6b7280", border:"1px solid #e5e7eb", borderRadius:12, padding:12 }}>
            {emptyMsg}
          </div>
        ) : rows.map(r => (
          <div key={r.id} style={{ border:"1px solid #e5e7eb", borderRadius:12, padding:12, background:"#fff", display:"grid", gap:6 }}>
            <div style={{ display:"flex", justifyContent:"space-between" }}>
              <strong>{r.number || r.id}</strong>
              <span style={{ fontSize:12, color:"#6b7280" }}>{fmtDate(r.date)}</span>
            </div>
            <div style={{ display:"flex", gap:8, alignItems:"center" }}>
              <StatusChip value={r.status} />
              <span style={{ marginLeft:"auto" }}>{fmtMoney(r.amount)}</span>
            </div>
            <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
              <button onClick={() => onView(r)} style={{ border:"1px solid #d1d5db", borderRadius:8, padding:"6px 10px", background:"#fff", cursor:"pointer" }}>Visa</button>
              {kind === 'offers' && (
                <button disabled title="Kommer i nästa steg" style={{ opacity:.6, border:"1px solid #d1d5db", borderRadius:8, padding:"6px 10px", background:"#fff" }}>Skapa order</button>
              )}
              <button onClick={() => onDelete(r)} disabled={busyDelId===r.id} style={{ border:"1px solid #ef4444", color:"#ef4444", borderRadius:8, padding:"6px 10px", background:"#fff", cursor:"pointer" }}>
                {busyDelId===r.id ? 'Raderar…' : 'Radera'}
              </button>
            </div>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div style={{ border: "1px solid #e5e7eb", borderRadius: "0 12px 12px 12px", background: "#fff" }}>
      <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640 }}>
        <thead>
          <tr style={{ background: "#f9fafb" }}>
            <th style={{ textAlign: "left", padding: 10, borderBottom: "1px solid #eee" }}>Nr</th>
            <th style={{ textAlign: "left", padding: 10, borderBottom: "1px solid #eee" }}>Datum</th>
            <th style={{ textAlign: "left", padding: 10, borderBottom: "1px solid #eee" }}>Belopp</th>
            <th style={{ textAlign: "left", padding: 10, borderBottom: "1px solid #eee" }}>Status</th>
            <th style={{ textAlign: "right", padding: 10, borderBottom: "1px solid #eee" }}>Åtgärder</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={5} style={{ padding: 14, color: "#6b7280" }}>
                {emptyMsg}
              </td>
            </tr>
          ) : (
            rows.map((r) => (
              <tr key={r.id} style={{ borderTop: "1px solid #f3f4f6" }}>
                <td style={{ padding: 10 }}>{r.number || r.id}</td>
                <td style={{ padding: 10 }}>{fmtDate(r.date)}</td>
                <td style={{ padding: 10 }}>{fmtMoney(r.amount)}</td>
                <td style={{ padding: 10 }}>
                  <StatusChip value={r.status} />
                </td>
                <td style={{ padding: 10, textAlign: "right", display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
                  <button onClick={() => onView(r)} style={{ border: "1px solid #d1d5db", borderRadius: 8, padding: "6px 10px", background: "#fff", cursor: "pointer" }}>
                    Visa
                  </button>
                  {kind === "offers" && (
                    <>
                      <button disabled title="Kommer i nästa steg" style={{ opacity: 0.6, border: "1px solid #d1d5db", borderRadius: 8, padding: "6px 10px", background: "#fff" }}>
                        Skapa order
                      </button>
                      <button onClick={() => onDelete(r)} disabled={busyDelId===r.id} style={{ border: '1px solid #ef4444', color:'#ef4444', borderRadius: 8, padding: '6px 10px', background: '#fff', cursor: 'pointer' }} title="Radera offert">
                        {busyDelId===r.id ? 'Raderar…' : 'Radera'}
                      </button>
                    </>
                  )}
                  {kind === "orders" && (
                    <button disabled title="Kommer i nästa steg" style={{ opacity: 0.6, border: "1px solid #d1d5db", borderRadius: 8, padding: "6px 10px", background: "#fff" }}>
                      Skapa faktura
                    </button>
                  )}
                  {kind === "invoices" && (
                    <button disabled title="Kommer i nästa steg" style={{ opacity: 0.6, border: "1px solid #d1d5db", borderRadius: 8, padding: "6px 10px", background: "#fff" }}>
                      Skicka till bokföring
                    </button>
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      </div>
    </div>
  );
}

export default function DocumentsTabs({ customerId }: { customerId: string }) {
  const [tab, setTab] = useState<"offers" | "orders" | "invoices">("offers");
  const [data, setData] = useState<{ offers: Doc[]; orders: Doc[]; invoices: Doc[] }>({ offers: [], orders: [], invoices: [] });
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<Doc | null>(null);
  const fileRef = useRef<HTMLInputElement|null>(null);
  const [busyUp, setBusyUp] = useState(false);
  const [busyDelId, setBusyDelId] = useState<string|null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const applyPatched = useApplyPatchedToCustomer();
  const router = useRouter();

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/customers/${encodeURIComponent(customerId)}/related-docs`, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (alive) setData(json);
      } catch (e: any) {
        if (alive) setErr(e?.message || "Fel vid hämtning");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [customerId]);

  useEffect(() => {
    const on = () => setIsMobile(window.innerWidth < 640);
    on();
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);

  const onView = async (row: Doc) => {
    try {
      const r = await fetch(`/api/documents/${encodeURIComponent(row.id)}/view`, { cache: 'no-store' });
      const j = await r.json();
      if (!r.ok || !j?.url) { alert('Kunde inte öppna dokumentet.'); return; }
      setView({ ...row, url: j.url });
      setOpen(true);
    } catch {
      alert('Nätverksfel – kunde inte öppna dokumentet.');
    }
  };

  async function onDelete(row: Doc) {
    if (!confirm("Radera dokumentet?")) return;
    try {
      setBusyDelId(row.id);
      const res = await fetch(`/api/documents/${encodeURIComponent(row.id)}`, { method: 'DELETE' });
      const txt = await res.text();
      if (!res.ok) {
        let msg = 'Kunde inte radera.';
        try { const j = JSON.parse(txt); msg += j.error ? `\n${j.error}${j.where?` (${j.where})`:''}` : ''; } catch {}
        alert(msg);
        return;
      }
      const r2 = await fetch(`/api/customers/${encodeURIComponent(customerId)}/related-docs`, { cache: 'no-store' });
      const json = await r2.json();
      setData(json);
    } finally {
      setBusyDelId(null);
    }
  }

  if (loading) return <div style={{ fontSize: 12, color: "#6b7280" }}>Laddar dokument…</div>;
  if (err) return <div style={{ fontSize: 12, color: "#b91c1c" }}>Kunde inte hämta dokument.</div>;

  const rows = tab === "offers" ? data.offers : tab === "orders" ? data.orders : data.invoices;

  return (
    <section style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "flex", gap: 6 }}>
        <TabButton active={tab === "offers"} onClick={() => setTab("offers")}>📄 Offerter</TabButton>
        <TabButton active={tab === "orders"} onClick={() => setTab("orders")}>📝 Order</TabButton>
        <TabButton active={tab === "invoices"} onClick={() => setTab("invoices")}>💰 Fakturor</TabButton>
      </div>
      {tab === "offers" && (
        <div style={{ display:"flex", justifyContent:"flex-end" }}>
          <input ref={fileRef} type="file" accept="application/pdf" onChange={async (e) => {
            const f = e.target.files?.[0]; if (!f) return;
            try {
              setBusyUp(true);
              const fd = new FormData(); fd.append("file", f);
              const res = await fetch(`/api/customers/${encodeURIComponent(customerId)}/offers/upload`, { method: "POST", body: fd });
              const txt = await res.text();
              let j: any = null; try { j = JSON.parse(txt); } catch {}
              if (!res.ok) { alert(j?.error || "Upload failed"); return; }
              console.info("UPLOAD RESPONSE", j);
              const autofill = j?.applied || j?.patched;
              if (autofill) {
                try { applyPatched(autofill); } catch {}
                setTimeout(() => {
                  try { router.refresh(); } catch { window.location.reload(); }
                }, 300);
              }
              else {
                console.warn("Ingen data att autofylla. Debug:", j?.debug);
              }
              const r2 = await fetch(`/api/customers/${encodeURIComponent(customerId)}/related-docs`, { cache: "no-store" });
              const json = await r2.json();
              setData(json); setTab("offers");
            } finally {
              setBusyUp(false); if (fileRef.current) fileRef.current.value = "";
            }
          }} style={{ display:"none" }} />
          <button onClick={() => fileRef.current?.click()} disabled={busyUp}
            style={{ fontSize:12, padding:"6px 10px", border:"1px solid #d1d5db", borderRadius:8, background:"#fff", cursor:"pointer" }}>
            {busyUp ? "Laddar…" : "Ladda upp offert (PDF)"}
          </button>
        </div>
      )}
      <Table rows={rows} onView={onView} onDelete={onDelete} kind={tab} isMobile={isMobile} busyDelId={busyDelId} />
      <Modal open={open} onClose={() => setOpen(false)} url={view?.url} title={`${view?.table === "offers" ? "Offert" : view?.table === "orders" ? "Order" : "Faktura"} ${view?.number || ""}`} />
    </section>
  );
}


