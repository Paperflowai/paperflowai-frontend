// src/components/PlusUploadMenu.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type NoteFile = { name: string; url: string; type: "image" | "pdf" };

export default function PlusUploadMenu({
  className = "",
  onAddNote,
}: {
  className?: string;
  onAddNote: (file: NoteFile) => void; // skickar tillbaka vald fil (image/pdf) som dataURL
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
    // Standard: visa under och vänsterjusterat med knappen
    let top = r.bottom + 8;
    let left = r.left;
    const width = 240;

    // Om inte får plats till höger -> flytta så den slutar vid högerkanten
    const overflowRight = left + width > window.innerWidth - 8;
    if (overflowRight) left = Math.max(8, window.innerWidth - width - 8);

    // Om inte får plats nedåt -> visa ovanför
    const menuHeight = 44 * 3; // tre rader ungefär
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
      if (btnRef.current && btnRef.current.contains(target)) return; // klick på knappen själv
      // klick utanför menyn stänger (själva menyn fångar event och stoppar propagation)
      setOpen(false);
    }
    window.addEventListener("resize", onResize);
    document.addEventListener("click", onDocClick);
    return () => {
      window.removeEventListener("resize", onResize);
      document.removeEventListener("click", onDocClick);
    };
  }, [open]);

  function readAsDataURL(f: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = reject;
      r.readAsDataURL(f);
    });
  }

  function compressImage(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      if (typeof window === "undefined") {
        reject(new Error("Window not available"));
        return;
      }
      
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error("Canvas context not available"));
        return;
      }
      
      const img = new Image();
      
      img.onload = () => {
        try {
          // Beräkna nya dimensioner (max 800px bredd)
          let { width, height } = img;
          const maxWidth = 800;
          
          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }
          
          canvas.width = width;
          canvas.height = height;
          
          // Rita bilden på canvas
          ctx.drawImage(img, 0, 0, width, height);
          
          // Konvertera till JPEG med komprimering
          const compressedDataURL = canvas.toDataURL('image/jpeg', 0.6);
          
          // Rensa upp
          URL.revokeObjectURL(img.src);
          
          resolve(compressedDataURL);
        } catch (error) {
          URL.revokeObjectURL(img.src);
          reject(error);
        }
      };
      
      img.onerror = () => {
        URL.revokeObjectURL(img.src);
        reject(new Error("Failed to load image"));
      };
      
      img.src = URL.createObjectURL(file);
    });
  }

  async function handlePick(
    e: React.ChangeEvent<HTMLInputElement>,
    type: "image" | "pdf"
  ) {
    const f = e.target.files?.[0];
    e.currentTarget.value = "";
    if (!f) return;
    
    // Skicka bara filnamnet, ingen dataURL för att undvika localStorage-problem
    onAddNote({
      name: f.name || (type === "pdf" ? "dokument.pdf" : "anteckning.jpg"),
      url: "", // Tom URL för att undvika localStorage-fel
      type,
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

      {/* Portal-meny – positionerad i viewport, inte klippt av parent */}
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
