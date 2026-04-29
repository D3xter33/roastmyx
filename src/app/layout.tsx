// src/app/layout.tsx

import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { BackgroundFX } from "@/components/BackgroundFX";

export const metadata: Metadata = {
  title: "RoastMyX — what your X profile actually looks like",
  description:
    "Paste any X handle. Get a brutally accurate, funny roast of their pfp, bio, banner, username and recent tweets. Disturbingly accurate. Emotionally unnecessary.",
  openGraph: {
    title: "RoastMyX",
    description:
      "The app that tells you what your X profile actually looks like.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "RoastMyX",
    description:
      "The app that tells you what your X profile actually looks like.",
  },
};

export const viewport: Viewport = {
  themeColor: "#09090b",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen antialiased font-sans">
        <BackgroundFX />
        {children}
        <Toaster />
      </body>
    </html>
  );
}
