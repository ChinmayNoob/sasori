import type { Metadata } from "next";
import { Manrope, Cormorant_Garamond } from "next/font/google";
import { Suspense } from "react";
import { AuthProvider } from "@/components/auth/AuthContext";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["200", "300", "400", "500", "600"],
});

const cormorant = Cormorant_Garamond({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "Sasori - Refined Ethereal AI",
  description: "Talk to your knowledge. An ethereal interface for data intelligence.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${manrope.variable} ${cormorant.variable} light`}>
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..200,0..1&display=swap" rel="stylesheet" />
      </head>
      <body className="text-sand-900 font-sans min-h-screen flex flex-col overflow-x-hidden selection:bg-stone-200 selection:text-black antialiased">
        <div className="layout-container flex h-full grow flex-col relative w-full">
          <Suspense fallback={<div className="min-h-screen bg-pearl-50" />}>
            <AuthProvider>
              {children}
            </AuthProvider>
          </Suspense>
        </div>
      </body>
    </html>
  );
}
