"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import DashboardCounter from "@/components/DashboardCounter";
import LogoutButton from "@/components/LogoutButton";

export default function FotaKvittoPage() {
  const router = useRouter();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [ocrResult, setOcrResult] = useState<any>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleCameraCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const url = URL.createObjectURL(file);
      setPreview(url);
      processImage(file);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const url = URL.createObjectURL(file);
      setPreview(url);
      processImage(file);
    }
  };

  const checkForDuplicates = (company: string, amount: number, date: string) => {
    const existingEntries = JSON.parse(localStorage.getItem("bookkeeping_entries") || "[]");
    
    // Kontrollera om det finns en liknande post
    const duplicate = existingEntries.find((entry: any) => {
      const sameCompany = entry.supplierName?.toLowerCase().includes(company.toLowerCase()) ||
                         company.toLowerCase().includes(entry.supplierName?.toLowerCase());
      const sameAmount = Math.abs((entry.amountInclVat || 0) - amount) < 1; // Tolerans på 1 kr
      const sameDate = entry.invoiceDate === date;
      
      return sameCompany && sameAmount && sameDate;
    });

    if (duplicate) {
      setDuplicateWarning(`⚠️ VARNING: Detta kvitto verkar redan vara bokfört! 
      
Leverantör: ${duplicate.supplierName}
Belopp: ${duplicate.amountInclVat} kr
Datum: ${duplicate.invoiceDate}
Status: ${duplicate.status}

Vill du ändå lägga till det?`);
    } else {
      setDuplicateWarning(null);
    }
  };

  const processImage = async (file: File) => {
    setIsProcessing(true);
    setOcrResult(null);
    setDuplicateWarning(null);

    try {
      // Konvertera till JPEG om det är HEIC
      let processedFile = file;
      if (file.type === "image/heic" || file.name.toLowerCase().endsWith(".heic")) {
        processedFile = await convertToJpeg(file);
      }

      const formData = new FormData();
      formData.append("file", processedFile, processedFile.name);

      const response = await fetch("/api/v1/receipt-ocr", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();
      
      // Konvertera från nya API-formatet till befintligt format
      if (result.ok && result.data) {
        const convertedResult = {
          company: result.data.merchant || "",
          total: result.data.total_amount || "",
          vat: result.data.vat_amount || "",
          date: result.data.date || "",
          raw_text: result.raw_text || ""
        };
        setOcrResult(convertedResult);
        
        // Kontrollera dubletter
        if (convertedResult.company && convertedResult.total) {
          const today = new Date().toISOString().slice(0, 10);
          checkForDuplicates(convertedResult.company, parseFloat(convertedResult.total), today);
        }
      } else {
        // Hantera fel från nya API:et
        setOcrResult({ error: result.message || "Kunde inte läsa kvittot. Försök igen." });
      }
    } catch (error) {
      console.error("OCR error:", error);
      setOcrResult({ error: "Kunde inte läsa kvittot. Försök igen." });
    } finally {
      setIsProcessing(false);
    }
  };

  const convertToJpeg = async (file: File): Promise<File> => {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      const img = new Image();

      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx?.drawImage(img, 0, 0);
        
        canvas.toBlob((blob) => {
          if (blob) {
            const jpegFile = new File([blob], file.name.replace(/\.[^/.]+$/, ".jpg"), {
              type: "image/jpeg",
            });
            resolve(jpegFile);
          } else {
            reject(new Error("Kunde inte konvertera bilden"));
          }
        }, "image/jpeg", 0.9);
      };

      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  };

  const addToBookkeeping = async () => {
    if (!ocrResult || !selectedFile) {
      alert("Ingen bild eller OCR-resultat hittades. Försök igen.");
      return;
    }

    try {
      // Konvertera belopp till nummer
      const totalAmount = parseFloat(ocrResult.total) || 0;
      const vatAmount = parseFloat(ocrResult.vat) || 0;

      // Skapa en bokföringspost baserat på OCR-resultatet
      const entry = {
        id: Date.now().toString(),
        type: "expense",
        supplierName: ocrResult.company || "Okänd leverantör",
        invoiceDate: new Date().toISOString().slice(0, 10),
        amountInclVat: totalAmount,
        vatAmount: vatAmount,
        status: "Att bokföra",
        fileKey: `kvitto_${Date.now()}`,
        fileMime: selectedFile.type,
      };

      // Spara i localStorage
      const existingEntries = JSON.parse(localStorage.getItem("bookkeeping_entries") || "[]");
      existingEntries.unshift(entry);
      localStorage.setItem("bookkeeping_entries", JSON.stringify(existingEntries));

      // Spara filen i IndexedDB
      try {
        const db = await openDB();
        const tx = db.transaction("files", "readwrite");
        await tx.objectStore("files").put(selectedFile, entry.fileKey);
      } catch (error) {
        console.error("Kunde inte spara filen:", error);
        // Fortsätt ändå, filen är inte kritisk
      }

      // Visa bekräftelse
      alert(`Kvitto från ${entry.supplierName} har lagts till i bokföringen!`);

      // Gå till bokföringen
      router.push("/dashboard/bookkeepingboard");
    } catch (error) {
      console.error("Fel vid sparning av kvitto:", error);
      alert("Ett fel uppstod vid sparning av kvittot. Försök igen.");
    }
  };

  const openDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open("paperflow-bk", 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains("files")) {
          db.createObjectStore("files");
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  };

  return (
    <main className="min-h-screen bg-gray-50 p-4">
      <LogoutButton />
      
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-center">📷 Fota kvitto</h1>
        
        {/* Tillbaka-knappar */}
        <div className="mb-4 flex justify-between">
          <div className="flex gap-2">
            <Link
              href="/start"
              className="bg-green-600 text-white px-4 py-2 rounded text-sm hover:bg-green-700 transition-colors"
            >
              🏠 Till Start
            </Link>
          </div>
          <Link
            href="/dashboard/bookkeepingboard"
            className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 transition-colors"
          >
            Till bokföringen →
          </Link>
        </div>

        <DashboardCounter />
        
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Välj hur du vill ladda upp kvittot</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Kamera */}
            <div className="text-center">
              <label className="block">
                <input
                  ref={cameraRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleCameraCapture}
                  className="hidden"
                />
                <div className="bg-blue-600 text-white p-6 rounded-lg cursor-pointer hover:bg-blue-700 transition-colors">
                  <div className="text-4xl mb-2">📷</div>
                  <div className="font-semibold">Fota kvitto</div>
                  <div className="text-sm opacity-90">Använd kameran</div>
                </div>
              </label>
            </div>

            {/* Filuppladdning */}
            <div className="text-center">
              <label className="block">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <div className="bg-green-600 text-white p-6 rounded-lg cursor-pointer hover:bg-green-700 transition-colors">
                  <div className="text-4xl mb-2">📁</div>
                  <div className="font-semibold">Välj fil</div>
                  <div className="text-sm opacity-90">Från galleriet</div>
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* Förhandsvisning */}
        {preview && (
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Förhandsvisning</h3>
              <button
                onClick={() => {
                  setSelectedFile(null);
                  setPreview(null);
                  setOcrResult(null);
                  setDuplicateWarning(null);
                  if (cameraRef.current) cameraRef.current.value = "";
                  if (fileRef.current) fileRef.current.value = "";
                }}
                className="bg-red-500 text-white p-2 rounded-full hover:bg-red-600 transition-colors"
                title="Ta bort bild"
              >
                🗑️
              </button>
            </div>
            <div className="text-center">
              <img
                src={preview}
                alt="Kvitto"
                className="max-w-full h-auto max-h-96 mx-auto rounded-lg border"
              />
            </div>
          </div>
        )}

        {/* OCR-resultat */}
        {isProcessing && (
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Läser kvittot...</p>
            </div>
          </div>
        )}

        {ocrResult && !isProcessing && (
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <h3 className="text-lg font-semibold mb-4">Läst information</h3>
            
            {ocrResult.error ? (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-600">{ocrResult.error}</p>
              </div>
            ) : (
              <>
                {/* Varning för dubletter */}
                {duplicateWarning && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                    <div className="flex items-start">
                      <div className="text-yellow-600 text-xl mr-3">⚠️</div>
                      <div>
                        <h4 className="font-semibold text-yellow-800 mb-2">Möjlig dubblett upptäckt!</h4>
                        <pre className="text-sm text-yellow-700 whitespace-pre-wrap">{duplicateWarning}</pre>
                      </div>
                    </div>
                  </div>
                )}
              <div className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Leverantör
                    </label>
                    <input
                      type="text"
                      value={ocrResult.company || ""}
                      className="w-full border rounded-lg px-3 py-2"
                      readOnly
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Totalbelopp
                    </label>
                    <input
                      type="text"
                      value={ocrResult.total || ""}
                      className="w-full border rounded-lg px-3 py-2"
                      readOnly
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Moms
                    </label>
                    <input
                      type="text"
                      value={ocrResult.vat || ""}
                      className="w-full border rounded-lg px-3 py-2"
                      readOnly
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Datum
                    </label>
                    <input
                      type="date"
                      value={new Date().toISOString().slice(0, 10)}
                      className="w-full border rounded-lg px-3 py-2"
                      readOnly
                    />
                  </div>
                </div>

                {ocrResult.raw_text && (
                  <details className="mt-4">
                    <summary className="cursor-pointer text-sm text-gray-600">
                      Visa råtext från OCR
                    </summary>
                    <pre className="mt-2 text-xs bg-gray-50 p-3 rounded border overflow-auto">
                      {ocrResult.raw_text}
                    </pre>
                  </details>
                )}

                <div className="flex gap-3 mt-6">
                  <button
                    onClick={addToBookkeeping}
                    className="flex-1 bg-blue-600 text-white py-3 px-6 rounded-lg hover:bg-blue-700 transition-colors font-semibold"
                  >
                    Lägg till i bokföringen →
                  </button>
                  <button
                    onClick={() => {
                      setSelectedFile(null);
                      setPreview(null);
                      setOcrResult(null);
                      setDuplicateWarning(null);
                      if (cameraRef.current) cameraRef.current.value = "";
                      if (fileRef.current) fileRef.current.value = "";
                    }}
                    className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Ta ny bild
                  </button>
                </div>
              </div>
              </>
            )}
          </div>
        )}

        {/* Instruktioner */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-semibold text-blue-900 mb-2">💡 Tips för bästa resultat:</h4>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Fotografera kvittot i bra ljus</li>
            <li>• Håll kameran stilla och rakt</li>
            <li>• Se till att all text är läsbar</li>
            <li>• Undvik skuggor och reflektioner</li>
          </ul>
        </div>
      </div>
    </main>
  );
}
