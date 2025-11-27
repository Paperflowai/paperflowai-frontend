// src/app/login/page.tsx
"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import OpenAccountingCta from "@/components/OpenAccountingCta";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  // Skapa konto
  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const { error } = await supabase.auth.signUp({ email, password });
    if (error) {
      setError(error.message);
    } else {
      alert("✅ Konto skapat! Kolla din e-post för bekräftelse.");
    }
  };

  // Logga in
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(error.message);
    } else {
      const next = searchParams.get("next");
      router.push(next ?? "/dashboard"); // Gå till ?next=... om satt, annars dashboard
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      {/* Tillbaka-knapp */}
      <div className="absolute top-4 left-4">
        <Link
          href="/"
          className="bg-black/30 hover:bg-black/50 px-4 py-2 rounded text-sm text-white"
        >
          ← Tillbaka
        </Link>
      </div>

      {/* Till bokföringen – visas bara om inloggad */}
      <div className="absolute top-4 right-4">
        <OpenAccountingCta />
      </div>

      <form className="bg-white p-6 rounded shadow-md space-y-4 w-80">
        <h1 className="text-xl font-bold text-center">Logga in / Skapa konto</h1>

        <input
          type="email"
          placeholder="E-post"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border px-3 py-2 rounded"
        />
        <input
          type="password"
          placeholder="Lösenord"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border px-3 py-2 rounded"
        />

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <button
          onClick={handleLogin}
          className="w-full bg-indigo-500 text-white py-2 rounded hover:bg-indigo-600"
        >
          Logga in
        </button>

        <button
          onClick={handleSignup}
          className="w-full bg-green-500 text-white py-2 rounded hover:bg-green-600"
        >
          Skapa konto
        </button>
      </form>
    </div>
  );
}
