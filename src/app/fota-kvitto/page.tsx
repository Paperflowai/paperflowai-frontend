"use client";
import { useState, useRef } from "react";
import Link from "next/link";

export default function FotaKvittoPage() {
  const [status, setStatus] = useState("");
  const [text, setText] = useState("");
  const fileRef = useRef<HTMLInputElement | null>(null);

  const handleImage = async (file: File) => {
    setStatus("Läser kvitto...");
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/ocr/image", { method: "POST", body: fd });
    const data = await res.json();
    if (data.ok) {
      setText(data.text || "");
      setStatus("Klart ✅");
    } else {
      setStatus("Fel ❌");
    }
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
        {status && <p className="text-sm mt-3">{status}</p>}
        {text && (
          <pre className="whitespace-pre-wrap text-sm bg-gray-50 mt-3 p-3 rounded border">{text}</pre>
        )}
      </div>
    </main>
  );
}
