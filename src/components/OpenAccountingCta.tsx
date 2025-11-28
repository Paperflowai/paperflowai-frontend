// src/components/OpenAccountingCta.tsx
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase, supabaseConfigured } from "@/lib/supabaseClient";

export default function OpenAccountingCta() {
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    let mounted = true;

    if (!supabaseConfigured) {
      setLoggedIn(false);
      return;
    }

    // Kolla om det finns session vid laddning
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (mounted) setLoggedIn(!!session);
    });

    // Lyssna på framtida login/logout
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => setLoggedIn(!!session)
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  if (!loggedIn) return null; // Utloggad → visa inget

  return (
    <Link
      href="/dashboard/bookkeepingboard"
      className="text-white hover:text-black border border-white hover:bg-white px-4 py-1 rounded text-xs sm:text-sm transition"
    >
      Öppna bokföring →
    </Link>
  );
}
