import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AppLayout } from "@/components/layout/AppLayout";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "Facturación MT",
  description: "Plataforma de gestión de facturación y control de gastos",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="antialiased">
      <body
        className={`${inter.variable} font-sans bg-gray-50 dark:bg-[#050505] text-gray-900 dark:text-gray-100 min-h-screen selection:bg-indigo-500/30`}
      >
        <AppLayout>{children}</AppLayout>
      </body>
    </html>
  );
}
