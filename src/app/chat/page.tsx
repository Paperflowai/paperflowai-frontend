// src/app/chat/page.tsx
"use client";

import Link from "next/link";
import { useState } from "react";
import { Paperclip, Mic, Send, FileImage, FileText, StickyNote } from "lucide-react";
import SaveOfferButton from "../../components/SaveOfferButton";
import DashboardCounter from "@/components/DashboardCounter";

export default function ChatPage() {
  const [messages, setMessages] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [showMenu, setShowMenu] = useState(false);

  const handleSend = () => {
    if (!input.trim()) return;
    setMessages((prev) => [...prev, input]);
    setInput("");
  };

  const handleUpload = (type: string) => {
    alert(`Du valde: ${type}`);
    setShowMenu(false);
  };

  // Vi använder sista meddelandet som "assistentens svar" som innehåller JSON.
  // (Pasta in GPT:ns JSON som sista meddelande och klicka "Spara till kundkort".)
  const lastAssistant = messages.length > 0 ? messages[messages.length - 1] : "";

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      {/* Banner */}
      <div className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-center py-3 shadow-md relative">
        <Link
          href="/start"
          className="absolute left-3 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-full text-sm bg-white/10 border border-white/20 text-white/90 hover:bg-white/20"
        >
          ← START
        </Link>
        <h1 className="text-lg font-bold">Börja skapa din offert, orderbekräftelse, faktura</h1>
        <p className="text-sm">Ladda upp foton och kladdlappar</p>
      </div>

      <DashboardCounter />

      {/* Meddelanden */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2 pb-24">
        {messages.length === 0 ? (
          <p className="text-gray-400 text-center">Din konversation börjar här…</p>
        ) : (
          messages.map((msg, i) => (
            <div key={i} className="bg-white p-2 rounded-lg shadow max-w-xs">
              {msg}
            </div>
          ))
        )}

        {/* Spara till kundkort-knapp (syns när det finns ett meddelande att läsa JSON ifrån) */}
        {messages.length > 0 && (
          <div className="mt-4">
            <SaveOfferButton assistantMessage={lastAssistant} />
          </div>
        )}
      </div>

      {/* Input-rad */}
      <div className="sticky bottom-0 left-0 right-0 bg-white border-t border-gray-300 px-3 py-2 flex items-center space-x-2">
        {/* + knapp */}
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-2 rounded-full bg-gray-200 hover:bg-gray-300"
          >
            <Paperclip size={20} />
          </button>
          {showMenu && (
            <div className="absolute bottom-12 left-0 bg-white shadow-lg rounded-md w-44 py-2 z-50">
              <button
                onClick={() => handleUpload("Foto")}
                className="flex items-center px-3 py-2 hover:bg-gray-100 w-full text-sm"
              >
                <FileImage className="mr-2" size={16} /> Ladda upp foto
              </button>
              <button
                onClick={() => handleUpload("PDF")}
                className="flex items-center px-3 py-2 hover:bg-gray-100 w-full text-sm"
              >
                <FileText className="mr-2" size={16} /> Ladda upp PDF
              </button>
              <button
                onClick={() => handleUpload("Kladdlapp")}
                className="flex items-center px-3 py-2 hover:bg-gray-100 w-full text-sm"
              >
                <StickyNote className="mr-2" size={16} /> Ladda upp kladdlapp
              </button>
            </div>
          )}
        </div>

        {/* Textfält */}
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Skriv ett meddelande..."
          className="flex-1 border rounded-full px-4 py-2 focus:outline-none"
        />

        {/* Voice-knapp */}
        <button className="p-2 rounded-full bg-gray-200 hover:bg-gray-300">
          <Mic size={20} />
        </button>

        {/* Skicka-knapp */}
        <button
          onClick={handleSend}
          className="p-2 rounded-full bg-indigo-500 text-white hover:bg-indigo-600"
        >
          <Send size={20} />
        </button>
      </div>
    </div>
  );
}
