"use client";
import { useState } from "react";

export default function ClearCacheButton({ small=false }: { small?: boolean }) {
  const [busy, setBusy] = useState(false);
  async function clearAll() {
    try {
      setBusy(true);
      // 1) Cache Storage (PWA-cachar)
      if ("caches" in window) {
        const names = await caches.keys();
        await Promise.all(names.map((n) => caches.delete(n)));
      }
      // 2) localStorage/sessionStorage
      try { localStorage.clear(); } catch {}
      try { sessionStorage.clear(); } catch {}
      // 3) IndexedDB (inkl. localforage/idb-keyval mm)
      try {
        const anyIDB: any = indexedDB as any;
        if (anyIDB?.databases) {
          const dbs = await anyIDB.databases();
          await Promise.all(
            dbs.map((db: any) => {
              if (!db?.name) return Promise.resolve();
              return new Promise<void>((resolve) => {
                const req = indexedDB.deleteDatabase(db.name as string);
                req.onsuccess = req.onerror = req.onblocked = () => resolve();
              });
            })
          );
        } else {
          // Fallback för browsers utan indexedDB.databases()
          ["localforage", "keyval-store", "workbox-expiration"].forEach((name) => {
            try { indexedDB.deleteDatabase(name); } catch {}
          });
        }
      } catch {}
      // 4) Service workers
      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
    } finally {
      window.location.reload();
    }
  }
  return (
    <button
      onClick={clearAll}
      disabled={busy}
      style={{
        padding: small ? "4px 8px" : "6px 10px",
        border: "1px solid #ddd",
        borderRadius: 6,
        cursor: "pointer",
        opacity: busy ? 0.5 : 1
      }}
      title="Töm cache + IndexedDB + SW och ladda om"
    >
      {busy ? "Rensar…" : "Rensa cache"}
    </button>
  );
}


