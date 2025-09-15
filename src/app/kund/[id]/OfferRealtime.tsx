"use client";
import { useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function OfferRealtime({ customerId }: { customerId: string }) {
  const router = useRouter();

  useEffect(() => {
    const channel = supabase
      .channel("offers-insert")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "offers", filter: `customer_id=eq.${customerId}` },
        (payload) => {
          const o = payload.new as any;
          const go = typeof window !== "undefined" && confirm("Ny offert skapad. Vill du öppna PDF:en nu?");
          if (go && o?.file_url) window.open(o.file_url as string, "_blank");
          // uppdatera listan på sidan
          router.refresh();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [customerId, router]);

  return null;
}

