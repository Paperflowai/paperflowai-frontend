// src/components/PlusUploadMenu.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type NoteFile = {
  name: string;
  type: "image" | "pdf";
  url?: string;
  blob?: Blob; // ← vi lägger till blob här
};

export default function PlusUploadMenu({
  className = "",
  onAddNote,
}: {
  className?: string;
  onAddNote: (file: NoteFile) => void;
}) {
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const camRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLInputElement>(null);
  const pdfRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  function toggle() {
    if (!btnRef.current) return;
    setOpen((s) => {
      const next = !s;
      if (next) computePosition();
      return next;
    });
  }

  function computePosition() {
    if (!btnRef.current || typeof window === "undefined") return;
    const r = btnRef.current.getBoundingClientRect();
    let top = r.bottom + 8;
    let left = r.left;
    const width = 240;

    const overflowRight = left + width > window.innerWidth - 8;
    if (overflowRight) left = Math.max(8, window.innerWidth - width - 8);

    const menuHeight = 44 * 3;
    const overflowBottom = top + menuHeight > window.innerHeight - 8;
    if (overflowBottom) top = Math.max(8, r.top - 8 - menuHeight);

    setPos({ top, left, width });
  }

  useEffect(() => {
    function onResize() {
      if (open) computePosition();
    }
    function onDocClick(e: MouseEvent) {
      if (!open) return;
      const target = e.target as Node;
      if (btnRef.current && btnRef.current.contains(target)) return;
      setOpen(false);
    }
    window.addEventListener("resize", onResize);
    document.addEventListener("click", onDocClick);
    return () => {
      window.removeEventListener("resize", onResize);
      document.removeEventListener("click", onDocClick);
    };
  }, [open]);

  async function handlePick(
    e: React.ChangeEvent<HTMLInputElement>,
    type: "image" | "pdf"
  ) {
    const f = e.target.files?.[0];
    e.currentTarget.value = "";
    if (!f) return;

    // Här skickar vi med blob
    onAddNote({
      name: f.name || (type === "pdf" ? "dokument.pdf" : "bild.jpg"),
      type,
      blob: f,
    });

    setOpen(false);
  }

  return (
    <>
      {/* Hidden inputs */}
      <input
        ref={camRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handlePick(e, "image")}
      />
      <input
        ref={imgRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handlePick(e, "image")}
      />
      <input
        ref={pdfRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => handlePick(e, "pdf")}
      />

      {/* "+"-knapp */}
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        className={`rounded-full w-10 h-10 flex items-center justify-center bg-gray-900 text-white text-xl leading-none shadow hover:opacity-90 active:scale-95 ${className}`}
        aria-label="Lägg till"
      >
        +
      </button>

      {/* Portal-meny */}
      {mounted && open && pos &&
        createPortal(
          <div
            role="menu"
            onClick={(e) => e.stopPropagation()}
            className="z-[9999] fixed rounded-xl border border-gray-200 bg-white shadow-lg overflow-hidden"
            style={{ top: pos.top, left: pos.left, width: pos.width }}
          >
            <button
              type="button"
              onClick={() => camRef.current?.click()}
              className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center gap-2"
            >
              <span>📷</span>
              <span>Fota anteckning</span>
            </button>
            <button
              type="button"
              onClick={() => imgRef.current?.click()}
              className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center gap-2"
            >
              <span>🖼️</span>
              <span>Ladda upp bild</span>
            </button>
            <button
              type="button"
              onClick={() => pdfRef.current?.click()}
              className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center gap-2"
            >
              <span>📄</span>
              <span>Ladda upp PDF</span>
            </button>
          </div>,
          document.body
        )}
    </>
  );
}
