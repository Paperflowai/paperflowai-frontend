/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {},
  env: {
    // Byggstämpel: uppdateras varje build/dev-start
    NEXT_PUBLIC_BUILD_TS: new Date().toISOString(),
  },
  async headers() {
    return [
      {
        source: "/kund/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store, max-age=0" },
          { key: "Pragma", value: "no-cache" },
          { key: "Expires", value: "0" }
        ],
      },
    ];
  },
};
export default nextConfig;


