"use client";
import { useEffect, useState, useRef } from "react";

type DocItem = { id: string; table: "offers"|"orders"|"invoices"; number?: string|null; date?: string|null; amount?: number|null; status?: string|null; url?: string|null; };

function List({ title, emoji, items, action }: { title: string; emoji: string; items: DocItem[]; action?: React.ReactNode }) {
  return (
    <div style={{border:"1px solid #e5e7eb", borderRadius:12, padding:12, background:"#fff"}}>
      <div style={{display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8}}>
        <div style={{fontWeight:700}}>{emoji} {title}</div>
        {action || null}
      </div>
      {items.length === 0 ? (
        <div style={{color:"#6b7280", fontSize:13}}>Inga {title.toLowerCase()} ännu.</div>
      ) : (
        <ul style={{listStyle:"none", margin:0, padding:0, display:"grid", gap:8}}>
          {items.slice(0,5).map((d) => {
            const label = d.number || d.id;
            const right: string[] = [];
            if (d.status) right.push(d.status);
            if (d.amount != null) right.push(new Intl.NumberFormat("sv-SE",{style:"currency", currency:"SEK"}).format(Number(d.amount)));
            return (
              <li key={`${d.table}-${d.id}`} style={{display:"flex", gap:8, alignItems:"center"}}>
                <span aria-hidden>•</span>
                {d.url ? (
                  <a href={d.url} target="_blank" rel="noreferrer">{label}</a>
                ) : (
                  <span>{label}</span>
                )}
                <span style={{marginLeft:"auto", fontSize:12, color:"#6b7280"}}>
                  {d.date ? new Date(d.date).toLocaleDateString() : ""}
                  {right.length ? " · " + right.join(" · ") : ""}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default function RelatedDocsPanel({ customerId }: { customerId: string }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{offers:DocItem[];orders:DocItem[];invoices:DocItem[]}>({offers:[],orders:[],invoices:[]});
  const [err, setErr] = useState<string|null>(null);
  const fileRef = useRef<HTMLInputElement|null>(null);
  const [busyUp, setBusyUp] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/customers/${encodeURIComponent(customerId)}/related-docs`, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (alive) setData(json);
      } catch (e:any) {
        if (alive) setErr(e.message || "Fel vid hämtning");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [customerId]);

  if (loading) return <div style={{fontSize:12, color:"#6b7280"}}>Laddar relaterade dokument…</div>;
  if (err) return <div style={{fontSize:12, color:"#b91c1c"}}>Kunde inte hämta relaterade dokument.</div>;

  return (
    <section aria-labelledby="rel-docs-title" style={{display:"grid", gap:12}}>
      <h3 id="rel-docs-title" style={{fontSize:18, fontWeight:700, margin:0}}>Relaterade dokument</h3>
      <div style={{display:"grid", gap:12, gridTemplateColumns:"repeat(auto-fit, minmax(240px, 1fr))"}}>
        <List 
          title="Offerter" 
          emoji="📄" 
          items={data.offers || []}
          action={
            <>
              <input ref={fileRef} type="file" accept="application/pdf" onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                try {
                  setBusyUp(true);
                  const fd = new FormData();
                  fd.append("file", f);
                  const res = await fetch(`/api/customers/${encodeURIComponent(customerId)}/offers/upload`, { method: "POST", body: fd });
                  if (!res.ok) throw new Error("Upload failed");
                  const r2 = await fetch(`/api/customers/${encodeURIComponent(customerId)}/related-docs`, { cache: "no-store" });
                  const json = await r2.json();
                  setData(json);
                } catch (e) {
                  alert("Kunde inte ladda upp offerten.");
                } finally {
                  setBusyUp(false);
                  if (fileRef.current) fileRef.current.value = "";
                }
              }} style={{ display: "none" }} />
              <button
                onClick={() => fileRef.current?.click()}
                disabled={busyUp}
                style={{ fontSize:12, padding:"6px 10px", border:"1px solid #d1d5db", borderRadius:8, background:"#fff", cursor:"pointer" }}
                title="Ladda upp offert (PDF)"
              >
                {busyUp ? "Laddar…" : "Ladda upp offert"}
              </button>
            </>
          }
        />
        <List title="Order" emoji="📝" items={data.orders || []} />
        <List title="Fakturor" emoji="💰" items={data.invoices || []} />
      </div>
    </section>
  );
}


