"use client";

import { useState } from "react";
import FotaKvitto from "@/components/FotaKvitto";
import CaptureReceipt from "@/components/CaptureReceipt";
import Link from "next/link";

type ReceiptData = {
  merchant?: string;
  date?: string;
  total?: string;
  vat?: string;
  currency?: string;
};

export default function KvittonPage() {
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
  const [useAdvancedCamera, setUseAdvancedCamera] = useState(false);

  const handleReceiptData = (data: ReceiptData) => {
    setReceiptData(data);
    console.log("Kvitto-data mottagen:", data);
  };

  const handleAdvancedReceiptData = (result: any) => {
    if (result.ok && result.data) {
      const converted: ReceiptData = {
        merchant: result.data.merchant || "",
        date: result.data.date || "",
        total: result.data.total_amount || "",
        vat: result.data.vat_amount || "",
        currency: result.data.currency || "SEK"
      };
      handleReceiptData(converted);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <Link 
            href="/dashboard"
            className="text-blue-600 hover:text-blue-800 text-sm"
          >
            ← Tillbaka till dashboard
          </Link>
        </div>

        <h1 className="text-3xl font-bold mb-6 text-center">📷 Kvitto-OCR Test</h1>
        
        {/* Komponent-väljare */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <h2 className="text-lg font-semibold mb-3">Välj kamera-komponent:</h2>
          <div className="flex gap-4">
            <button
              onClick={() => setUseAdvancedCamera(false)}
              className={`px-4 py-2 rounded ${!useAdvancedCamera 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-200 text-gray-700'}`}
            >
              Enkel FotaKvitto
            </button>
            <button
              onClick={() => setUseAdvancedCamera(true)}
              className={`px-4 py-2 rounded ${useAdvancedCamera 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-200 text-gray-700'}`}
            >
              Avancerad CaptureReceipt
            </button>
          </div>
        </div>

        {/* Kvitto-komponenter */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          {useAdvancedCamera ? (
            <div>
              <h3 className="text-lg font-semibold mb-4">Avancerad kamera med kvalitetsfeedback</h3>
              <CaptureReceipt 
                onResult={handleAdvancedReceiptData}
                className="max-w-md mx-auto"
              />
            </div>
          ) : (
            <div>
              <h3 className="text-lg font-semibold mb-4">Enkel kvitto-fotning</h3>
              <FotaKvitto 
                onData={handleReceiptData}
                className="max-w-md mx-auto"
              />
            </div>
          )}
        </div>

        {/* Resultat */}
        {receiptData && (
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">Extraherade uppgifter</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Handelsplats
                </label>
                <input
                  type="text"
                  value={receiptData.merchant || ""}
                  readOnly
                  className="w-full border rounded-lg px-3 py-2 bg-gray-50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Datum
                </label>
                <input
                  type="text"
                  value={receiptData.date || ""}
                  readOnly
                  className="w-full border rounded-lg px-3 py-2 bg-gray-50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Totalbelopp
                </label>
                <input
                  type="text"
                  value={receiptData.total || ""}
                  readOnly
                  className="w-full border rounded-lg px-3 py-2 bg-gray-50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Moms
                </label>
                <input
                  type="text"
                  value={receiptData.vat || ""}
                  readOnly
                  className="w-full border rounded-lg px-3 py-2 bg-gray-50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Valuta
                </label>
                <input
                  type="text"
                  value={receiptData.currency || ""}
                  readOnly
                  className="w-full border rounded-lg px-3 py-2 bg-gray-50"
                />
              </div>
            </div>
            
            <div className="mt-4 flex gap-3">
              <button
                onClick={() => setReceiptData(null)}
                className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
              >
                Rensa
              </button>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(JSON.stringify(receiptData, null, 2));
                  alert("Kopierat till clipboard!");
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Kopiera JSON
              </button>
            </div>
          </div>
        )}

        {/* Instruktioner */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6">
          <h4 className="font-semibold text-blue-900 mb-2">💡 Test-instruktioner:</h4>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• <strong>Enkel komponent</strong>: Grundläggande filuppladdning med OCR</li>
            <li>• <strong>Avancerad komponent</strong>: Live kamera med kvalitetsfeedback</li>
            <li>• Testa med olika kvitton (ICA, Coop, Hemköp, etc.)</li>
            <li>• Kontrollera att datum, belopp och moms extraheras korrekt</li>
          </ul>
        </div>
      </div>
    </main>
  );
}
