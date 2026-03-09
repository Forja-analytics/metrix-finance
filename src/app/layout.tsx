import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/layout/Navbar";
import { AuthModal } from "@/components/layout/AuthModal";
import { Web3Provider } from "@/components/providers/Web3Provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Principia Metrics - DeFi Analytics & Portfolio Tracking",
  description: "Advanced DeFi analytics platform. Track, analyze, and optimize your concentrated liquidity positions with precision metrics.",
  keywords: ["DeFi", "Uniswap", "Liquidity Pool", "Portfolio Tracking", "Crypto Analytics", "Yield Optimization"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen bg-background text-foreground grid-pattern`}
        suppressHydrationWarning
      >
        <Web3Provider>
          <Navbar />
          <main className="pt-16">
            {children}
          </main>
          <AuthModal />
        </Web3Provider>
      </body>
    </html>
  );
}
