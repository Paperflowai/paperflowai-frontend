"use client";

import { useEffect, useState, useCallback } from "react";

type Document = {
  id: string;
  type: "offert" | "orderbekräftelse" | "faktura";
  title: string;
  amount: number | null;
  currency: string | null;
  file_url: string;
  created_at: string;
  status: string | null;
  needs_print?: boolean | null;
};

type DocumentSummary = {
  total: number;
  offers: number;
  orders: number;
  invoices: number;
};

export default function DocumentOverview({ customerId }: { customerId: string }) {
  const [documents, setDocuments] = useState<Document[] | null>(null);
  const [summary, setSummary] = useState<DocumentSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    
    (async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/customers/${customerId}/documents`, { 
          cache: "no-store" 
        });
        
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        
        if (!cancelled) {
          setDocuments(json.documents ?? []);
          setSummary(json.summary);
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Fel vid hämtning");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [customerId]);

  const getStatusColor = (status: string | null, type: string) => {
    if (type === "orderbekräftelse" || type === "faktura") {
      return "text-green-600";
    }
    
    switch (status) {
      case "order_confirmed": return "text-green-600";
      case "sent": return "text-orange-600";
      default: return "text-red-600";
    }
  };

  const getStatusText = (status: string | null, type: string) => {
    if (type === "orderbekräftelse" || type === "faktura") {
      return "✓ Klar";
    }
    
    switch (status) {
      case "order_confirmed": return "✓ Klar";
      case "sent": return "⚠ Skickad";
      default: return "✗ Ej skickad";
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "offert": return "📄";
      case "orderbekräftelse": return "📋";
      case "faktura": return "💰";
      default: return "📄";
    }
  };

  const handleSendToBookkeeping = useCallback(async (doc: Document) => {
    if (!confirm(`Skicka ${doc.title} till bokföringen?`)) return;

    try {
      const res = await fetch("/api/bookkeeping/add-invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: customerId,
          invoiceUrl: doc.file_url,
          title: doc.title,
          amount: doc.amount,
          currency: doc.currency,
          created_at: doc.created_at
        }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      
      alert(`${doc.title} skickad till bokföringen!`);
    } catch (e: any) {
      alert(`Kunde inte skicka till bokföring: ${e?.message ?? "okänt fel"}`);
    }
  }, [customerId]);

  if (loading) return <div className="text-sm text-gray-500">Laddar dokument...</div>;
  if (error) return <div className="text-sm text-red-600">Fel: {error}</div>;

  return (
    <div className="space-y-4">
      {/* Sammanfattning */}
      {summary && (
        <div className="bg-gray-50 rounded-lg p-3 md:p-4">
          <h3 className="font-semibold text-gray-800 mb-2 text-sm md:text-base">Dokumentsammanfattning</h3>
          <div className="grid grid-cols-4 gap-2 md:gap-4 text-xs md:text-sm">
            <div className="text-center">
              <div className="text-lg md:text-2xl font-bold text-blue-600">{summary.total}</div>
              <div className="text-gray-600 text-xs">Totalt</div>
            </div>
            <div className="text-center">
              <div className="text-lg md:text-2xl font-bold text-orange-600">{summary.offers}</div>
              <div className="text-gray-600 text-xs">Offerter</div>
            </div>
            <div className="text-center">
              <div className="text-lg md:text-2xl font-bold text-green-600">{summary.orders}</div>
              <div className="text-gray-600 text-xs">Order</div>
            </div>
            <div className="text-center">
              <div className="text-lg md:text-2xl font-bold text-purple-600">{summary.invoices}</div>
              <div className="text-gray-600 text-xs">Fakturor</div>
            </div>
          </div>
        </div>
      )}

      {/* Dokumentlista */}
      <div className="bg-white rounded-lg border">
        <div className="px-3 md:px-4 py-2 md:py-3 border-b bg-gray-50">
          <h3 className="font-semibold text-gray-800 text-sm md:text-base">Alla dokument</h3>
        </div>
        
        {!documents || documents.length === 0 ? (
          <div className="p-4 md:p-8 text-center text-gray-500 text-sm">
            Inga dokument ännu för denna kund.
          </div>
        ) : (
          <div className="divide-y">
            {documents.map((doc) => (
              <div key={doc.id} className="p-3 md:p-4 hover:bg-gray-50 transition-colors">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 md:gap-3">
                  <div className="flex items-center gap-2 md:gap-3">
                    <span className="text-lg md:text-xl">{getTypeIcon(doc.type)}</span>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-gray-900 text-sm md:text-base">
                        {doc.title}
                        {doc.amount && (
                          <span className="ml-1 md:ml-2 text-gray-600 text-xs md:text-sm">
                            • {doc.amount} {doc.currency}
                          </span>
                        )}
                      </div>
                      <div className="text-xs md:text-sm text-gray-500">
                        {new Date(doc.created_at).toLocaleDateString("sv-SE")} • 
                        {doc.type.charAt(0).toUpperCase() + doc.type.slice(1)}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between md:justify-end gap-2 md:gap-3">
                    <span className={`text-xs font-medium ${getStatusColor(doc.status, doc.type)}`}>
                      {getStatusText(doc.status, doc.type)}
                    </span>
                    
                    <div className="flex gap-1 md:gap-2">
                      <a
                        href={doc.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2 md:px-3 py-1 md:py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                      >
                        Öppna
                      </a>
                      <a
                        href={doc.file_url}
                        download
                        className="px-2 md:px-3 py-1 md:py-1.5 text-xs border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition-colors"
                      >
                        Ladda ner
                      </a>
                      {doc.type === "faktura" && (
                        <button
                          onClick={() => handleSendToBookkeeping(doc)}
                          className="px-2 md:px-3 py-1 md:py-1.5 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                        >
                          📚 Bokföring
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
