// src/app/chat/page.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import SavingsToast from "@/components/SavingsToast";
import { addSaving } from "@/lib/savings";

// Ladda klient-only för att undvika hydration-varningar
const MicButton = dynamic(() => import("@/components/MicButton"), { ssr: false });
const PlusUploadMenu = dynamic(() => import("@/components/PlusUploadMenu"), { ssr: false });

type Msg = { role: "user" | "assistant"; content: string };

// ===== Hjälpare: timpris (700 kr/h default, kan läsas från localStorage) =====
function getHourlyRate(): number {
  if (typeof window === "undefined") return 700;
  const saved = localStorage.getItem("pf_hourly_rate_sek");
  const n = saved ? Number(saved) : NaN;
  return Number.isFinite(n) && n > 0 ? n : 700;
}

// ===== Hjälpare: enkel uppskattning av sparade minuter =====
function estimateMinutesSaved(userText: string): number {
  const t = userText.toLowerCase();
  if (/\boffert\b/.test(t)) return 50;  // t.ex. 50 min för offert
  if (/\border\b/.test(t)) return 30;   // t.ex. 30 min för order
  if (/\bfaktura\b/.test(t)) return 40; // t.ex. 40 min för faktura
  return 20; // standard om något annat skapas
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", content: "Hej! Vad vill du skapa idag – offert, order eller faktura?" },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  // Toast-state
  const [toastOpen, setToastOpen] = useState(false);
  const [toastMinutes, setToastMinutes] = useState(0);
  const [toastAmount, setToastAmount] = useState(0);

  // auto-scroll vid nya meddelanden
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    const content = input.trim();
    if (!content) return;

    const base = [...messages, { role: "user" as const, content }];
    setMessages(base);
    setInput("");
    setLoading(true);

    // lägg till tomt assistant-svar som vi fyller på med stream
    setMessages((prev) => [...prev, { role: "assistant" as const, content: "" }]);

    try {
      const resp = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            { role: "system", content: "Du hjälper hantverkare att skapa offerter, order och fakturor." },
            ...base,
          ],
        }),
      });
      if (!resp.ok || !resp.body) throw new Error("Chat API error");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder("utf-8");

      let acc = "";
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });

        const parts = acc.split("\n");
        for (const line of parts) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          if (trimmed.startsWith("data: ")) {
            const payload = trimmed.slice(6);
            if (payload === "[DONE]") continue;
            try {
              const json = JSON.parse(payload);
              const delta = json?.choices?.[0]?.delta?.content ?? "";
              if (delta) {
                setMessages((prev) => {
                  const copy = [...prev];
                  const last = copy[copy.length - 1];
                  if (last?.role === "assistant") last.content += delta;
                  return copy;
                });
              }
            } catch {
              setMessages((prev) => {
                const copy = [...prev];
                const last = copy[copy.length - 1];
                if (last?.role === "assistant") last.content += payload;
                return copy;
              });
            }
          }
        }
      }

      // === Stream färdig → visa toast och uppdatera banner ===
      const minutes = estimateMinutesSaved(content);
      const amount = Math.round((minutes / 60) * getHourlyRate());

      // Toast
      setToastMinutes(minutes);
      setToastAmount(amount);
      setToastOpen(true);
      setTimeout(() => setToastOpen(false), 4000);

      // Ackumulerad besparing → uppdaterar banner (SavingsBadge/Summary)
      addSaving({ minutes, amountSEK: amount, source: "chat" });

    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Kunde inte hämta svar just nu." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <header className="border-b px-4 sm:px-6 py-3 flex items-center gap-3">
        <div className="h-2.5 w-2.5 rounded-full bg-teal-500" />
        <h1 className="font-semibold">Assistent</h1>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Link
            href="/dashboard"
            className="bg-teal-600 hover:bg-teal-700 text-white rounded-lg px-3 py-2 text-sm"
          >
            Kundregister
          </Link>
          <Link
            href="/dashboard/bookkeepingboard"
            className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-3 py-2 text-sm"
          >
            Bokföring
          </Link>
        </div>
      </header>

      {/* Meddelandelista */}
      <div ref={listRef} className="flex-1 overflow-auto px-4 sm:px-6 py-4">
        <div className="mx-auto max-w-3xl space-y-4">
          {messages.map((m, i) => (
            <div
              key={i}
              className={`rounded-2xl px-4 py-3 whitespace-pre-wrap leading-relaxed ${
                m.role === "user"
                  ? "bg-teal-50 text-gray-900 self-end"
                  : "bg-gray-50 text-gray-900"
              }`}
            >
              {m.content}
            </div>
          ))}
          {loading && <div className="text-sm text-gray-500">Skriver…</div>}
        </div>
      </div>

      {/* Input */}
      <form onSubmit={sendMessage} className="border-t px-4 sm:px-6 py-3">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-end gap-2">
            {/* ➕ längst till vänster */}
            <PlusUploadMenu
              onAddNote={(file) => {
                // Lägg en kort rad i input som kontext till GPT (enkelt läge)
                const tag = file.type === "pdf" ? "PDF" : "Bild";
                setInput((prev) =>
                  prev
                    ? `${prev}\n[${tag} uppladdad: ${file.name}]`
                    : `[${tag} uppladdad: ${file.name}]`
                );
              }}
            />

            <textarea
              className="flex-1 border rounded-xl p-3 min-h-[44px] max-h-40 resize-y"
              placeholder="Skriv eller tala in: 'Skapa en offert för badrumsrenovering 6 m²…'"
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />

            {/* 🎤 Röst till text */}
            <MicButton
              className="rounded-xl"
              onText={(t) => setInput((prev) => (prev ? prev + "\n" + t : t))}
            />

            <button
              type="submit"
              className="bg-gradient-to-r from-teal-500 to-blue-500 text-white rounded-xl px-4 py-2 font-medium disabled:opacity-50"
              disabled={loading || !input.trim()}
            >
              Skicka
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Tips: använd ➕ för att fota/ladda upp anteckningar (bild/PDF) eller 🎤 för att tala in.
          </p>
        </div>
      </form>

      {/* 💡 Toast längst ner */}
      <SavingsToast
        open={toastOpen}
        minutes={toastMinutes}
        amountSEK={toastAmount}
        onClose={() => setToastOpen(false)}
      />
    </div>
  );
}
