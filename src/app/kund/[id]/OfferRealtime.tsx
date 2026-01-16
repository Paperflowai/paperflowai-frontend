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
        async (payload) => {
          const o = payload.new as any;
          console.log("[OfferRealtime] New offer created:", o);

          // Ge Supabase tid att propagera ändringar (500ms)
          await new Promise(resolve => setTimeout(resolve, 500));

          // Ladda om sidan för att hämta uppdaterad kunddata
          window.location.reload();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [customerId, router]);

  return null;
}

