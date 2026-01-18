// src/app/layout.tsx
import type { Metadata } from "next";
import "./globals.css"; // ✅ Viktig för Tailwind och styling

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
      <body className="bg-gray-100 text-gray-900">
        {children}
        <footer className="text-center text-xs text-gray-500 py-4">
          © 2026 PaperflowAI. All rights reserved.
        </footer>
      </body>
    </html>
  );
}
