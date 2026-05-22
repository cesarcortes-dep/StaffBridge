import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Guest Reviews — Premium Propiedades",
  description: "Triage guest reviews across the portfolio in five minutes.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-neutral-100 text-neutral-900">
        <header className="border-b border-neutral-200 bg-white">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
            <Link href="/" className="flex items-baseline gap-2">
              <span className="text-base font-semibold">Guest Reviews</span>
              <span className="text-xs text-neutral-500">
                Premium Propiedades
              </span>
            </Link>
            <nav className="flex items-center gap-4 text-sm">
              <Link
                href="/"
                className="text-neutral-700 hover:text-neutral-900"
              >
                Portfolio
              </Link>
              <Link
                href="/queue"
                className="text-neutral-700 hover:text-neutral-900"
              >
                Unanswered queue
              </Link>
              <Link
                href="/themes"
                className="text-neutral-700 hover:text-neutral-900"
              >
                Themes
              </Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-6">
          {children}
        </main>
      </body>
    </html>
  );
}
