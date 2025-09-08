// src/app/banner-layout.tsx
"use client";

import { usePathname } from "next/navigation";
import TeaserBanner from "@/components/TeaserBanner";

export default function BannerLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Sidor där vi INTE vill visa bannern
  const hiddenPaths = ["/", "/dashboard", "/offert", "/order", "/faktura", "/bokforing", "/tidsrapport"];

  const shouldShow = !hiddenPaths.includes(pathname);

  return (
    <div>
      {shouldShow && (
        <div className="flex items-center justify-center bg-gradient-to-r from-blue-600 to-teal-500 text-white text-xs py-1 px-3 shadow">
          {/* Själva bannern i mitten */}
          <TeaserBanner />
        </div>
      )}
      {children}
    </div>
  );
}
