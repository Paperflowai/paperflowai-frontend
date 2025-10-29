// src/components/NavFooter.tsx
"use client";
import { useRouter } from "next/navigation";

export default function NavFooter() {
  const router = useRouter();

  return (
    <div className="fixed bottom-0 left-0 w-full bg-white border-t border-gray-200 flex justify-between items-center px-4 py-2 shadow-inner z-50">
      {/* Tillbaka-knappen */}
      <button
        onClick={() => router.back()}
        className="px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium"
      >
        ← Tillbaka
      </button>

      {/* Nästa-knappen (just nu leder den till dashboard, men du kan ändra) */}
      <button
        onClick={() => router.push("/dashboard")}
        className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white font-medium"
      >
        Nästa →
      </button>
    </div>
  );
}
