// src/components/RequireAuth.tsx
"use client";

import { ReactNode, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function RequireAuth({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ok, setOk] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        // Skicka utloggade till login och spara vart de var på väg
        router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      } else {
        setOk(true);
      }
    });
  }, [router, pathname]);

  // Visa inget medan vi kollar session
  if (!ok) return null;

  return <>{children}</>;
}
