// src/components/LogoutButton.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function LogoutButton() {
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const router = useRouter();

  const handleLogout = async () => {
    if (isLoggingOut) return;
    
    setIsLoggingOut(true);
    try {
      await supabase.auth.signOut();
      router.push("/");
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <button
      onClick={handleLogout}
      disabled={isLoggingOut}
      className="
        fixed top-2 right-2 z-50
        bg-red-500/80 hover:bg-red-600/90 
        text-white text-xs px-2 py-1 rounded-full
        backdrop-blur-sm border border-red-400/50
        transition-all duration-200
        disabled:opacity-50 disabled:cursor-not-allowed
        sm:px-3 sm:py-1.5 sm:text-sm
      "
      title="Logga ut"
    >
      {isLoggingOut ? "..." : "Logga ut"}
    </button>
  );
}
