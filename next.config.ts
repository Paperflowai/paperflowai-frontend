import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@supabase/supabase-js", "@supabase/realtime-js"],
  serverExternalPackages: ["openai"],
};

export default nextConfig;
