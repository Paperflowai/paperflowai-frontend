"use client";

import { usePathname, useRouter } from "next/navigation";

export default function GoBookkeepingButton() {
  const router = useRouter();
  const pathname = usePathname();
  if ((pathname || "/") === "/") return null;
  return (
    <button
      type="button"
      onClick={() => router.push("/dashboard/bookkeepingboard")}
      aria-label="Till bokföringen"
      title="Till bokföringen"
      className="fixed z-40 top-[env(safe-area-inset-top,8px)] right-2 rounded-full bg-black/60 text-white backdrop-blur px-2.5 py-1 shadow text-xs"
    >
      Till bokföringen
    </button>
  );
}
