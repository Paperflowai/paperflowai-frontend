"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";

type OrderRow = {
  id: string;
  description: string;
  qty: number;
  price: number;
  source: "offer" | "extra";
  approved: boolean;
  approved_at: string | null;
};

type Order = {
  id: string;
  number: string;
  status: string;
  created_at: string;
  total: number;
  vat_total: number;
  data: {
    customer: {
      companyName: string;
      contactPerson: string;
      email: string;
      phone: string;
    };
    rows: OrderRow[];
  };
  customer: {
    company_name: string;
    contact_person: string;
    email: string;
    phone: string;
  };
};

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = String(params?.orderId ?? "");

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [description, setDescription] = useState("");
  const [qty, setQty] = useState(1);
  const [price, setPrice] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!orderId) return;

    const fetchOrder = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/orders/${orderId}`);
        const json = await res.json();

        if (!res.ok || !json.ok) {
          throw new Error(json.error || "Kunde inte hämta order");
        }

        setOrder(json.order);
      } catch (e: any) {
        setError(e.message || "Ett fel uppstod");
      } finally {
        setLoading(false);
      }
    };

    fetchOrder();
  }, [orderId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!description.trim()) {
      alert("Beskrivning krävs");
      return;
    }

    if (qty <= 0) {
      alert("Antal måste vara större än 0");
      return;
    }

    if (price <= 0) {
      alert("Pris måste vara större än 0");
      return;
    }

    try {
      setSubmitting(true);

      const res = await fetch(`/api/orders/${orderId}/add-item`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description,
          qty,
          price,
        }),
      });

      const json = await res.json();

      if (!res.ok || !json.ok) {
        throw new Error(json.error || "Kunde inte lägga till tillägg");
      }

      // Update order locally with new item
      if (order && json.order) {
        setOrder(json.order);
      }

      // Reset form
      setDescription("");
      setQty(1);
      setPrice(0);

      alert("Tillägg tillagt!");
    } catch (e: any) {
      alert(`Fel: ${e.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white p-6 flex items-center justify-center">
        <p className="text-gray-600">Laddar order...</p>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-white p-6 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error || "Order hittades inte"}</p>
          <Link href="/dashboard" className="text-blue-600 hover:underline">
            ← Tillbaka till dashboard
          </Link>
        </div>
      </div>
    );
  }

  const rows = order.data?.rows || [];
  const customer = order.data?.customer || order.customer;

  return (
    <div className="min-h-screen bg-white p-6 text-gray-800 max-w-4xl mx-auto">
      {/* Header */}
      <header className="mb-6">
        <Link
          href={`/kund/${order.customer_id || ""}`}
          className="text-sm text-gray-600 hover:underline mb-2 inline-block"
        >
          ← Tillbaka till kund
        </Link>
        <h1 className="text-3xl font-bold">Order {order.number}</h1>
        <p className="text-sm text-gray-600">
          Status: <span className="font-medium">{order.status}</span>
        </p>
        <p className="text-sm text-gray-600">
          Skapad: {new Date(order.created_at).toLocaleString("sv-SE")}
        </p>
      </header>

      {/* Customer Info */}
      <section className="bg-gray-50 border rounded-lg p-4 mb-6">
        <h2 className="text-lg font-semibold mb-2">Kund</h2>
        <p className="text-sm">
          <strong>Företag:</strong> {customer?.companyName || customer?.company_name}
        </p>
        <p className="text-sm">
          <strong>Kontaktperson:</strong> {customer?.contactPerson || customer?.contact_person}
        </p>
        <p className="text-sm">
          <strong>E-post:</strong> {customer?.email}
        </p>
        <p className="text-sm">
          <strong>Telefon:</strong> {customer?.phone}
        </p>
      </section>

      {/* Order Rows */}
      <section className="border rounded-lg p-4 mb-6">
        <h2 className="text-lg font-semibold mb-3">Orderrader</h2>
        {rows.length === 0 ? (
          <p className="text-sm text-gray-500">Inga rader ännu</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b">
              <tr>
                <th className="text-left py-2">Beskrivning</th>
                <th className="text-right py-2">Antal</th>
                <th className="text-right py-2">Pris</th>
                <th className="text-right py-2">Summa</th>
                <th className="text-left py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const total = row.qty * row.price;
                const isExtra = row.source === "extra";
                const isApproved = row.approved;

                return (
                  <tr key={row.id} className="border-b">
                    <td className="py-2">
                      {row.description}
                      {isExtra && (
                        <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                          TILLÄGG
                        </span>
                      )}
                    </td>
                    <td className="text-right py-2">{row.qty}</td>
                    <td className="text-right py-2">{row.price.toFixed(2)} kr</td>
                    <td className="text-right py-2">{total.toFixed(2)} kr</td>
                    <td className="py-2">
                      {isApproved ? (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                          GODKÄND
                        </span>
                      ) : (
                        <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">
                          EJ GODKÄNT
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      {/* Add Item Form */}
      <section className="border rounded-lg p-4 mb-6">
        <h2 className="text-lg font-semibold mb-3">Lägg till tillägg</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex flex-col">
            <label htmlFor="description" className="text-sm font-medium mb-1">
              Beskrivning
            </label>
            <input
              id="description"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="border p-2 rounded"
              placeholder="T.ex. Extra målning"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col">
              <label htmlFor="qty" className="text-sm font-medium mb-1">
                Antal
              </label>
              <input
                id="qty"
                type="number"
                min="1"
                step="1"
                value={qty}
                onChange={(e) => setQty(parseFloat(e.target.value))}
                className="border p-2 rounded"
                required
              />
            </div>

            <div className="flex flex-col">
              <label htmlFor="price" className="text-sm font-medium mb-1">
                Pris (kr)
              </label>
              <input
                id="price"
                type="number"
                min="0"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(parseFloat(e.target.value))}
                className="border p-2 rounded"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? "Lägger till..." : "Lägg till tillägg"}
          </button>
        </form>
      </section>
    </div>
  );
}
