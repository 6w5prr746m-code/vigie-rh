import type { Metadata, Viewport } from "next";
import "./globals.css";
import AppBar from "@/components/AppBar";
import Toaster from "@/components/Toaster";
import { prisma } from "@/lib/db";

export const metadata: Metadata = { title: "Vigie RH", description: "Veille commerciale SIRH" };
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };
export const dynamic = "force-dynamic";

// Applique habillage et mode avant le premier rendu (évite le flash de thème)
const themeInit = `try{var s=JSON.parse(localStorage.getItem("vigie.skin")||'"apple"');document.documentElement.dataset.skin=s;var m=JSON.parse(localStorage.getItem("vigie.mode")||"null");if(m)document.documentElement.dataset.theme=m}catch(e){document.documentElement.dataset.skin="apple"}`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const demoCount = await prisma.company.count({ where: { isDemo: true } });
  return (
    <html lang="fr" data-skin="apple" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@500;700;800&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap" />
      </head>
      <body>
        <AppBar hasDemo={demoCount > 0} />
        {children}
        <Toaster />
      </body>
    </html>
  );
}
