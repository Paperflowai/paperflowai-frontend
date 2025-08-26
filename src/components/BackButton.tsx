"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function BackButton() {
  const router = useRouter();
  const pathname = usePathname();
  const [canGoBack, setCanGoBack] = useState(false);

  useEffect(() => {
    const hasRef = typeof document !== "undefined" && document.referrer && document.referrer !== location.href;
    const hasHist = typeof history !== "undefined" && (history.length || 0) > 1;
    setCanGoBack(Boolean(hasRef || hasHist));
  }, [pathname]);

  if ((pathname || "/") === "/") return null;

  function onBack() {
    if (typeof history !== "undefined" && history.length > 1) {
      history.back();
    } else {
      router.push("/");
    }
  }

  return (
    <button
      type="button"
      onClick={onBack}
      aria-label="Tillbaka"
      title="Tillbaka"
      className="fixed z-40 top-[env(safe-area-inset-top,8px)] left-2 rounded-full bg-black/60 text-white backdrop-blur px-2.5 py-1 shadow md:px-2 md:py-1 text-xs"
      style={{ display: canGoBack ? "inline-flex" : "inline-flex" }}
    >
      ← Tillbaka
    </button>
  );
}
