"use client";

import { usePathname, useRouter } from "next/navigation";

export default function BackButton() {
  const router = useRouter();
  const pathname = usePathname();

  if ((pathname || "/") === "/") return null;

  function onBack() {
    router.back();
  }

  return (
    <button
      type="button"
      onClick={onBack}
      aria-label="Tillbaka"
      title="Tillbaka"
      className="fixed z-40 top-[env(safe-area-inset-top,8px)] left-2 rounded-full bg-black/60 text-white backdrop-blur px-2.5 py-1 shadow md:px-2 md:py-1 text-xs"
    >
      ← Tillbaka
    </button>
  );
}
