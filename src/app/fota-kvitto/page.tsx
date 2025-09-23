"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";

export default function FotaKvittoPage() {
  const [status, setStatus] = useState("");
  const [text, setText] = useState("");
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleImage = async (file: File) => {
    setStatus("Läser kvitto...");
    setIsLoading(true);
    setProgress(5);
    // Visa förhandsgranskning
    try {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    } catch {}
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);

    // Simulerad progress tills svaret kommer
    let cancelled = false;
    const tick = () => {
      setProgress((p) => {
        if (cancelled) return p;
        const next = p < 90 ? p + Math.max(1, Math.round((100 - p) * 0.06)) : p; // avtagande takt upp till 90%
        return Math.min(next, 90);
      });
    };
    const interval = setInterval(tick, 400);
    const fd = new FormData();
    fd.append("file", file);
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 45000);
    try {
      const res = await fetch("/api/ocr/image", { method: "POST", body: fd, signal: ctrl.signal });
      const data = await res.json().catch(() => ({ ok: false, error: "Bad JSON" }));
      cancelled = true;
      clearInterval(interval);
      if (res.ok && data.ok) {
        setProgress(100);
        setText(data.text || "");
        setStatus("Klart ✅");
      } else {
        setProgress(0);
        setStatus(`Fel ❌ ${data?.error || res.status}`);
      }
    } catch (e: any) {
      cancelled = true;
      clearInterval(interval);
      setProgress(0);
      setStatus(`Fel ❌ ${e?.name === 'AbortError' ? 'Timeout (45s)' : (e?.message || 'Nätverksfel')}`);
    } finally {
      clearTimeout(to);
      setTimeout(() => setIsLoading(false), 400);
    }
  };

  // Rensa minnet för objectURL
  useEffect(() => {
    return () => {
      try { if (previewUrl) URL.revokeObjectURL(previewUrl); } catch {}
    };
  }, [previewUrl]);

  const clearReceipt = () => {
    try { if (previewUrl) URL.revokeObjectURL(previewUrl); } catch {}
    setPreviewUrl("");
    setText("");
    setStatus("");
    setProgress(0);
    setIsLoading(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <main className="px-4 py-6 max-w-3xl mx-auto">
      <div className="mb-4 flex justify-between">
        <Link href="/start" className="bg-green-600 text-white px-4 py-2 rounded text-sm hover:bg-green-700 transition-colors">🏠 Tillbaka till Start</Link>
      </div>
      <h1 className="text-2xl font-bold mb-4">📷 Fota kvitto</h1>
      <div className="border rounded p-4 bg-white">
        <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={(e)=>{
          const f = e.currentTarget.files?.[0]; if (f) handleImage(f);
        }} />
        <p className="text-sm text-gray-600 mt-2">Välj eller fota ett kvitto så läser vi ut texten.</p>

        {/* Progressbar */}
        {isLoading && (
          <div className="mt-4">
            <div className="flex items-center justify-between text-sm text-gray-600 mb-1">
              <span>Läser kvitto…</span>
              <span>{progress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded h-2 overflow-hidden">
              <div className="bg-blue-600 h-2 transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}

        {/* Förhandsgranskning + papperskorg */}
        {previewUrl && (
          <div className="mt-4 relative inline-block">
            <img src={previewUrl} alt="Kvitto" className="max-h-64 rounded border" />
            <button
              type="button"
              aria-label="Ta bort kvitto"
              onClick={clearReceipt}
              className="absolute top-1 right-1 bg-white/90 hover:bg-white text-red-600 border rounded px-2 py-0.5 text-sm shadow"
              title="Ta bort kvitto"
            >
              🗑️
            </button>
          </div>
        )}

        {status && <p className="text-sm mt-3">{status}</p>}
        {text && (
          <pre className="whitespace-pre-wrap text-sm bg-gray-50 mt-3 p-3 rounded border">{text}</pre>
        )}
      </div>
    </main>
  );
}
