// src/app/layout.tsx
import type { Metadata, Viewport } from "next";
import "./globals.css";
import BackButton from "../components/BackButton";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: "Offertplattform",
  description: "Automatisera offerter, order och fakturor med AI",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="sv">
      <head>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover"
        />
      </head>
      <body className="bg-gray-100 text-gray-900 overflow-x-hidden">
        {/* Lägg knappen före children */}
        <BackButton />
        {children}
      </body>
    </html>
  );
}
