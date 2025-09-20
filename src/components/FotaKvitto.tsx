"use client";

import { useState } from "react";

type ReceiptData = {
  merchant?: string;
  date?: string;
  total?: string;
  vat?: string;
  currency?: string;
};

type Props = {
  onData: (data: ReceiptData) => void;
  className?: string;
  disabled?: boolean;
};

export default function FotaKvitto({ onData, className = "", disabled = false }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError("");
    setLoading(true);

    try {
      const fd = new FormData();
      fd.append("file", file);

      const res = await fetch("/api/v1/receipt-ocr", { method: "POST", body: fd });
      const json = await res.json();

      if (!res.ok || !json.ok) {
        const code = json?.code;
        if (code === "NO_TEXT_FOUND" || code === "LOW_IMAGE_QUALITY") {
          throw new Error("Bildkvalitet otillräcklig – fota igen i bättre ljus och fyll bildrutan med kvittot.");
        }
        if (code === "FILE_TOO_LARGE") {
          const max = json?.details?.maxSizeMb ?? 15;
          throw new Error(`Bilden är för stor. Max ${max}MB.`);
        }
        if (code === "RATE_LIMIT_EXCEEDED") {
          const s = json?.details?.retryAfter ?? 60;
          throw new Error(`För många förfrågningar – vänta ${s}s och försök igen.`);
        }
        throw new Error(json?.message || "Kunde inte läsa kvittot.");
      }

      // Konvertera från API-format till komponent-format
      const receiptData: ReceiptData = {
        merchant: json.data?.merchant || "",
        date: json.data?.date || "",
        total: json.data?.total_amount || "",
        vat: json.data?.vat_amount || "",
        currency: json.data?.currency || "SEK"
      };

      onData(receiptData);
    } catch (err: any) {
      setError(err?.message || "Fel vid kvitto-OCR.");
    } finally {
      setLoading(false);
      e.currentTarget.value = ""; // låt användaren ladda upp samma fil igen
    }
  }

  return (
    <div className={`w-full ${className}`}>
      <label className="block text-sm font-medium mb-2">Fota kvitto</label>
      <input
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleChange}
        disabled={loading || disabled}
        className="block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:font-semibold file:bg-gray-100 hover:file:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
      />
      
      {loading && (
        <div className="text-sm text-blue-600 mt-2 flex items-center">
          <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
          </svg>
          Läser kvittot…
        </div>
      )}
      
      {error && (
        <p className="text-sm text-red-600 mt-2 bg-red-50 p-2 rounded border border-red-200">
          {error}
        </p>
      )}

      <details className="mt-3 text-xs text-gray-500">
        <summary className="cursor-pointer hover:text-gray-700">Tips för bättre läsning</summary>
        <ul className="list-disc ml-5 mt-1 space-y-1">
          <li>Bra ljus, undvik skuggor</li>
          <li>Fyll bildrutan med kvittot</li>
          <li>Håll kameran still och horisontell</li>
          <li>Se till att all text är läsbar</li>
        </ul>
      </details>
    </div>
  );
}
