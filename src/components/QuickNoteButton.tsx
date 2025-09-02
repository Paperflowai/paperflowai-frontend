// src/components/QuickNoteButton.tsx
"use client";

import { useRef, useState } from "react";

export default function QuickNoteButton({
  onImage,
  className = "",
}: {
  onImage: (file: { name: string; url: string }) => void;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.currentTarget.value = "";
    if (!f) return;

    setBusy(true);
    try {
      // Läs filen som data-url (så den kan sparas direkt i localStorage)
      const reader = new FileReader();
      reader.onload = () => {
        const url = reader.result as string;
        onImage({ name: f.name || "anteckning.jpg", url });
      };
      reader.readAsDataURL(f);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={onPick}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
          busy ? "bg-gray-200 text-gray-500" : "bg-orange-600 hover:bg-orange-700 text-white"
        } ${className}`}
        title="Fota kladdlapp"
      >
        {busy ? "Laddar…" : "📷 Fota kladdlapp"}
      </button>
    </>
  );
}
