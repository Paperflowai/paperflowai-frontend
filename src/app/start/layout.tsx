// src/app/start/layout.tsx
"use client";

import RequireAuth from "@/components/RequireAuth";

export default function StartLayout({ children }: { children: React.ReactNode }) {
  return <RequireAuth>{children}</RequireAuth>;
}
