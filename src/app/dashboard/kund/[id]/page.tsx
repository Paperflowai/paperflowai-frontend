"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function KundDetaljsida() {
  const params = useParams();
  const router = useRouter();
  const id = parseInt(params.id as string);

  const [data, setData] = useState({
    companyName: "",
    orgNr: "",
    contactPerson: "",
    role: "",
    phone: "",
    email: "",
    address: "",
    zip: "",
    city: "",
    country: "Sverige",
    contactDate: "",
    notes: "",
    customerNumber: ""
  });

  const [images, setImages] = useState<{ name: string; url: string }[]>([]);
  const [offert, setOffert] = useState<{ name: string; url: string } | null>(null);
  const [order, setOrder] = useState<{ name: string; url: string } | null>(null);
  const [invoice, setInvoice] = useState<{ name: string; url: string } | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem(`kund_${id}`);
    if (saved) {
      const parsed = JSON.parse(saved);
      setData(parsed);
    } else {
      const nyttKundnummer = `K-${Math.floor(100000 + Math.random() * 900000)}`;
      const initialData = { ...data, customerNumber: nyttKundnummer };
      localStorage.setItem(`kund_${id}`, JSON.stringify(initialData));
      setData(initialData);
    }

    const savedImages = localStorage.getItem(`kund_images_${id}`);
    if (savedImages) setImages(JSON.parse(savedImages));

    const savedOffert = localStorage.getItem(`kund_offert_${id}`);
    if (savedOffert) setOffert(JSON.parse(savedOffert));

    const savedOrder = localStorage.getItem(`kund_order_${id}`);
    if (savedOrder) setOrder(JSON.parse(savedOrder));

    const savedInvoice = localStorage.getItem(`kund_invoice_${id}`);
    if (savedInvoice) setInvoice(JSON.parse(savedInvoice));
  }, [id]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value } = e.target;
    setData((prev) => {
      const updated = { ...prev, [name]: value };
      localStorage.setItem(`kund_${id}`, JSON.stringify(updated));
      return updated;
    });
  }

  function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const uploaded = e.target.files;
    if (!uploaded) return;

    Array.from(uploaded).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const newImage = { name: file.name, url: result };
        setImages((prev) => {
          const updated = [...prev, newImage];
          localStorage.setItem(`kund_images_${id}`, JSON.stringify(updated));
          return updated;
        });
      };
      reader.readAsDataURL(file);
    });
  }

  function deleteImage(index: number) {
    setImages((prev) => {
      const updated = [...prev.slice(0, index), ...prev.slice(index + 1)];
      localStorage.setItem(`kund_images_${id}`, JSON.stringify(updated));
      return updated;
    });
  }

  function handleSpecialUpload(
    e: React.ChangeEvent<HTMLInputElement>,
    type: "offert" | "order" | "invoice"
  ) {
    const uploaded = e.target.files?.[0];
    if (!uploaded) return;

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const newFile = { name: uploaded.name, url: result };
      if (type === "offert") {
        setOffert(newFile);
        localStorage.setItem(`kund_offert_${id}`, JSON.stringify(newFile));
      } else if (type === "order") {
        setOrder(newFile);
        localStorage.setItem(`kund_order_${id}`, JSON.stringify(newFile));
      } else if (type === "invoice") {
        setInvoice(newFile);
        localStorage.setItem(`kund_invoice_${id}`, JSON.stringify(newFile));
      }
    };
    reader.readAsDataURL(uploaded);
  }

  async function skickaEpost(pdfUrl: string, typ: string) {
    const subject = `Här kommer din ${typ} från ${data.companyName}`;
    const text = `Hej ${data.contactPerson || "kund"},\n\nHär kommer din ${typ}.\n\nLänk: ${pdfUrl}`;

    await fetch("/api/sendEmail", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: data.email, subject, text }),
    });

    alert(`${typ} skickad till ${data.email}`);
  }

  return (
    <div className="min-h-screen bg-white p-6 text-gray-800 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Kundkort</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <input name="companyName" value={data.companyName} onChange={handleChange} placeholder="Företagsnamn" className="border p-2 rounded" />
        <input name="orgNr" value={data.orgNr} onChange={handleChange} placeholder="Organisationsnummer" className="border p-2 rounded" />
        <input name="customerNumber" value={data.customerNumber} onChange={handleChange} placeholder="Kundnummer" className="border p-2 rounded" />
        <input name="contactPerson" value={data.contactPerson} onChange={handleChange} placeholder="Kontaktperson" className="border p-2 rounded" />
        <input name="role" value={data.role} onChange={handleChange} placeholder="Befattning" className="border p-2 rounded" />
        <input name="phone" value={data.phone} onChange={handleChange} placeholder="Telefonnummer" className="border p-2 rounded" />
        <input name="email" value={data.email} onChange={handleChange} placeholder="E-post" className="border p-2 rounded" />
        <input name="address" value={data.address} onChange={handleChange} placeholder="Adress" className="border p-2 rounded" />
        <input name="zip" value={data.zip} onChange={handleChange} placeholder="Postnummer" className="border p-2 rounded" />
        <input name="city" value={data.city} onChange={handleChange} placeholder="Ort" className="border p-2 rounded" />
        <input name="country" value={data.country} onChange={handleChange} placeholder="Land" className="border p-2 rounded" />
        <input name="contactDate" type="date" value={data.contactDate} onChange={handleChange} className="border p-2 rounded" />
      </div>

      <h2 className="text-xl font-bold mt-8">📷 Bilder och kladdlappar</h2>
      <input type="file" accept="image/*" multiple onChange={handleImageUpload} className="mt-2 mb-4 text-blue-700 font-semibold cursor-pointer" />
      <div className="grid grid-cols-2 gap-4 mb-6">
        {images.map((img, idx) => (
          <div key={idx} className="border p-2 rounded shadow relative">
            <img src={img.url} alt={img.name} className="w-full h-auto rounded" />
            <p className="text-xs mt-1 break-all">{img.name}</p>
            <button
              onClick={() => deleteImage(idx)}
              className="absolute top-1 right-1 text-red-600 text-sm font-bold bg-white px-2 py-0.5 rounded"
              title="Ta bort bild"
            >
              🗑️
            </button>
          </div>
        ))}
      </div>

      <h2 className="text-xl font-bold mt-8">GPT-genererade dokument</h2>

      {/* Offert */}
      <div className="mb-4">
        <p className="font-semibold">🧾 Offert (PDF):</p>
        <input type="file" accept="application/pdf" onChange={(e) => handleSpecialUpload(e, "offert")} className="text-blue-700 font-semibold cursor-pointer" />
        {offert && (
          <div className="mt-2 space-y-2">
            <div className="flex justify-between items-center gap-4">
              <p className="text-sm text-blue-600">📎 {offert.name}</p>
              <div className="flex gap-2">
                <button onClick={() => { setOffert(null); localStorage.removeItem(`kund_offert_${id}`); }} className="text-red-600 text-sm font-semibold hover:underline">🗑️ Ta bort</button>
              </div>
            </div>
            <iframe src={offert.url} className="w-full h-64 border rounded" title="Offert PDF"></iframe>
            <div className="flex gap-2 mt-2">
              <button onClick={() => skickaEpost(offert.url, "offert")} className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700">
                📤 Skicka
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Order */}
      <div className="mb-4">
        <p className="font-semibold">📑 Orderbekräftelse (PDF):</p>
        <input type="file" accept="application/pdf" onChange={(e) => handleSpecialUpload(e, "order")} className="text-blue-700 font-semibold cursor-pointer" />
        {order && (
          <div className="mt-2 space-y-2">
            <div className="flex justify-between items-center">
              <p className="text-sm text-blue-600">📎 {order.name}</p>
              <button onClick={() => { setOrder(null); localStorage.removeItem(`kund_order_${id}`); }} className="text-red-600 text-sm font-semibold hover:underline">🗑️ Ta bort</button>
            </div>
            <iframe src={order.url} className="w-full h-64 border rounded" title="Order PDF"></iframe>
            <div className="flex gap-2 mt-2">
              <button onClick={() => skickaEpost(order.url, "orderbekräftelse")} className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700">
                📤 Skicka
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Faktura */}
      <div className="mb-4">
        <p className="font-semibold">💰 Faktura (PDF):</p>
        <input type="file" accept="application/pdf" onChange={(e) => handleSpecialUpload(e, "invoice")} className="text-blue-700 font-semibold cursor-pointer" />
        {invoice && (
          <div className="mt-2 space-y-2">
            <div className="flex justify-between items-center">
              <p className="text-sm text-blue-600">📎 {invoice.name}</p>
              <button onClick={() => { setInvoice(null); localStorage.removeItem(`kund_invoice_${id}`); }} className="text-red-600 text-sm font-semibold hover:underline">🗑️ Ta bort</button>
            </div>
            <iframe src={invoice.url} className="w-full h-64 border rounded" title="Faktura PDF"></iframe>
            <div className="flex gap-2 mt-2">
              <button onClick={() => skickaEpost(invoice.url, "faktura")} className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700">
                📤 Skicka
              </button>
            </div>
          </div>
        )}
      </div>

      <textarea name="notes" value={data.notes} onChange={handleChange} placeholder="Anteckningar..." rows={6} className="w-full border p-3 rounded mb-4" />
      <div className="flex gap-4 mt-6">
        <button onClick={() => window.print()} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">🖨️ Skriv ut / Exportera PDF</button>
        <Link href="/dashboard"><button className="bg-gray-300 hover:bg-gray-400 text-black px-4 py-2 rounded">← Tillbaka</button></Link>
      </div>
    </div>
  );
}
