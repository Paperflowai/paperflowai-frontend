"use client";

import { useState } from "react";

async function toJpegBlob(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no canvas ctx");
    ctx.drawImage(img, 0, 0);
    return await new Promise<Blob>((res, rej) =>
      canvas.toBlob((b) => (b ? res(b) : rej(new Error("toBlob failed"))), "image/jpeg", 0.92)
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function OcrTestPage() {
  const [result, setResult] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;

    setPreview(URL.createObjectURL(f));

    const fd = new FormData();
    try {
      const jpeg = await toJpegBlob(f);
      const filename = (f.name?.replace(/\.[^.]+$/, "") || "image") + ".jpg";
      fd.append("file", jpeg, filename);
    } catch {
      fd.append("file", f, f.name);
    }

    setLoading(true);
    setErr(null);
    setResult(null);

    try {
      const r = await fetch("/api/ocr", { method: "POST", body: fd });
      const text = await r.text();
      let data: any = null;
      try { data = text ? JSON.parse(text) : null; } catch { /* not json */ }
      if (!r.ok) {
        const msg = data?.backend?.message || data?.detail || data?.error || text || "OCR-fel";
        throw new Error(msg);
      }
      setResult(data ?? { raw: text });
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  const company = result?.company ?? result?.företag ?? null;
  const total = result?.total ?? result?.summa ?? null;
  const vat = result?.vat ?? result?.moms ?? null;

  return (
    <main className="min-h-screen p-4 md:p-6">
      <h1 className="text-xl font-semibold mb-4">OCR-test</h1>
      <input
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFile}
        className="block mb-4"
      />

      {preview && (
        <img src={preview} alt="Förhandsvisning" className="max-h-64 rounded border mb-4" onLoad={(e)=>URL.revokeObjectURL((e.target as HTMLImageElement).src)} />
      )}

      {loading && <p>Kör OCR…</p>}
      {err && <p className="text-red-600">{err}</p>}

      {result && (
        <div className="space-y-2">
          <div>
            <span className="font-medium">Företag: </span>
            <span>{company ?? "—"}</span>
          </div>
          <div>
            <span className="font-medium">Total: </span>
            <span>{total != null ? String(total) : "—"}</span>
          </div>
          <div>
            <span className="font-medium">Moms: </span>
            <span>{vat != null ? String(vat) : "—"}</span>
          </div>
          <details className="mt-3">
            <summary className="cursor-pointer">Rå JSON-svar</summary>
            <pre className="mt-2 whitespace-pre-wrap break-words border rounded p-3 bg-gray-50 text-sm">{JSON.stringify(result, null, 2)}</pre>
          </details>
        </div>
      )}
    </main>
  );
}
