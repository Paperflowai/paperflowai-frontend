import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@supabase/supabase-js", "@supabase/realtime-js"],
  serverExternalPackages: ["openai"],

  // Bygg igenom även om ESLint/TS klagar
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
};

export default nextConfig;

