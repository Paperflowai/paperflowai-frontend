// src/app/kund/[id]/mobil/page.tsx
"use client";

import { useParams } from "next/navigation";
import { useRef, useState, useEffect } from "react";
import Link from "next/link";

type BkFile = { name: string; url: string; type: "image" | "pdf" };

export default function MobilKvittoPage() {
  const params = useParams();
  const raw = Array.isArray((params as any).id) ? (params as any).id[0] : (params as any).id;
  const id = Number.isFinite(Number(raw)) && Number(raw) > 0 ? Number(raw) : 1;

  const [supplier, setSupplier] = useState("");
  const [amountIncl, setAmountIncl] = useState("");
  const [vat, setVat] = useState("");
  const [date, setDate] = useState("");
  const [selected, setSelected] = useState<{ name: string; dataUrl: string; type: "image" | "pdf" } | null>(null);
  const [message, setMessage] = useState("");

  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Sätt dagens datum när komponenten mountar
    setDate(new Date().toISOString().slice(0, 10));
  }, []);

  function autoVat(v: string) {
    setAmountIncl(v);
    const n = Number(v.replace(",", "."));
    if (Number.isFinite(n)) setVat(String(Math.round(((n * 20) / 125) * 100) / 100)); // 25% inkl
  }

  function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () =>
      setSelected({
        name: f.name,
        dataUrl: r.result as string,
        type: f.type.startsWith("image/") ? "image" : "pdf",
      });
    r.readAsDataURL(f);
    e.currentTarget.value = "";
  }

  function save(draft: boolean) {
    if (!supplier.trim() && !amountIncl && !selected) {
      setMessage("⚠️ Fyll i leverantör eller välj en fil.");
      return;
    }
    const keyExp = `kund_expenses_${id}`;
    const prevExp: any[] = JSON.parse(localStorage.getItem(keyExp) || "[]");
    prevExp.push({
      supplier: supplier.trim(),
      amountIncl: Number(amountIncl.replace(",", ".")) || 0,
      vat: Number(vat.replace(",", ".")) || 0,
      date,
      fileName: selected?.name,
      fileType: selected?.type,
      fileDataUrl: selected?.dataUrl,
      draft,
    });
    localStorage.setItem(keyExp, JSON.stringify(prevExp));

    if (selected) {
      const keyBk = `kund_bookkeeping_${id}`;
      const prevBk: BkFile[] = JSON.parse(localStorage.getItem(keyBk) || "[]");
      prevBk.push({ name: selected.name, url: selected.dataUrl, type: selected.type });
      localStorage.setItem(keyBk, JSON.stringify(prevBk));
    }

    setSupplier("");
    setAmountIncl("");
    setVat("");
    setDate(new Date().toISOString().slice(0, 10));
    setSelected(null);
    setMessage(draft ? "💾 Utkast sparat" : "✅ Sparat & bokfört");
  }

  return (
    <div className="min-h-screen bg-white text-gray-900 p-4 max-w-md mx-auto">
      <header className="flex items-center gap-3 mb-4">
        <Link href={`/kund/${id}`} className="text-blue-600 underline">
          ← Till kundkort
        </Link>
        <h1 className="text-xl font-semibold">Lägg till kvitto/utgift</h1>
      </header>

      {message && <div className="mb-3 rounded-lg border p-3 text-sm">{message}</div>}

      {/* Leverantör */}
      <div className="mb-3">
        <label className="text-sm text-gray-600 mb-1 block">Leverantör</label>
        <input
          className="w-full border rounded-lg p-4"
          placeholder="t.ex. Byggmax"
          value={supplier}
          onChange={(e) => setSupplier(e.target.value)}
        />
      </div>

      {/* Belopp / Moms */}
      <div className="grid grid-cols-1 gap-3 mb-3">
        <div>
          <label className="text-sm text-gray-600 mb-1 block">Belopp (inkl. moms)</label>
          <input
            inputMode="decimal"
            className="w-full border rounded-lg p-4"
            placeholder="0"
            value={amountIncl}
            onChange={(e) => autoVat(e.target.value)}
          />
        </div>
        <div>
          <label className="text-sm text-gray-600 mb-1 block">Moms</label>
          <input
            inputMode="decimal"
            className="w-full border rounded-lg p-4"
            placeholder="0"
            value={vat}
            onChange={(e) => setVat(e.target.value)}
          />
        </div>
      </div>

      {/* Datum */}
      <div className="mb-3">
        <label className="text-sm text-gray-600 mb-1 block">Datum</label>
        <input
          type="date"
          className="w-full border rounded-lg p-4"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </div>

      {/* 📷 Fota – MOBIL ENDAST */}
      <div className="sm:hidden space-y-3 mb-3">
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={pick} />
        <button type="button" onClick={() => cameraRef.current?.click()} className="w-full bg-green-600 text-white font-semibold rounded-lg py-4">
          📷 Fota kvitto
        </button>
      </div>

      {/* 📄 Välj fil – ALLTID SYNLIG */}
      <div className="space-y-3 mb-4">
        <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={pick} />
        <button type="button" onClick={() => fileRef.current?.click()} className="w-full bg-indigo-600 text-white font-semibold rounded-lg py-4">
          📄 Välj fil
        </button>
        {selected && <p className="text-xs text-gray-600 break-all">Vald fil: {selected.name}</p>}
      </div>

      {/* Spara */}
      <div className="grid grid-cols-2 gap-3">
        <button onClick={() => save(false)} className="bg-green-700 text-white rounded-lg py-3 font-semibold disabled:opacity-50" disabled={!selected && !supplier && !amountIncl}>
          Spara & bokför
        </button>
        <button onClick={() => save(true)} className="border rounded-lg py-3 font-semibold">
          Spara som utkast
        </button>
      </div>

      <p className="text-xs text-gray-500 mt-4">
        Filer och uppgifter sparas lokalt under kunden och syns på kundkortets bokföringslista.
      </p>
    </div>
  );
}
