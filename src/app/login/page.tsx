// src/app/login/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);

    let res;
    if (mode === "login") {
      res = await supabase.auth.signInWithPassword({ email, password });
    } else {
      res = await supabase.auth.signUp({ email, password });
    }

    setLoading(false);

    if (res.error) {
      setErr(res.error.message);
      return;
    }
    router.push("/dashboard");
  }

  return (
    <main className="min-h-screen flex items-start justify-center p-6">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-center mb-6">Logga in</h1>

        <div className="mb-4 flex gap-2">
          <button
            type="button"
            onClick={() => setMode("login")}
            className={`px-3 py-2 rounded ${mode === "login" ? "bg-black text-white" : "border"}`}
          >
            Logga in
          </button>
          <button
            type="button"
            onClick={() => setMode("signup")}
            className={`px-3 py-2 rounded ${mode === "signup" ? "bg-black text-white" : "border"}`}
          >
            Skapa konto
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block mb-1">E-post</label>
            <input
              type="email"
              className="w-full border rounded px-3 py-2"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <div>
            <label className="block mb-1">Lösenord</label>
            <input
              type="password"
              className="w-full border rounded px-3 py-2"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>

          {err && <p className="text-red-600 text-sm">{err}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded px-4 py-2 bg-black text-white disabled:opacity-60"
          >
            {loading ? (mode === "login" ? "Loggar in…" : "Skapar konto…") : (mode === "login" ? "Logga in" : "Skapa konto")}
          </button>
        </form>
      </div>
    </main>
  );
}
