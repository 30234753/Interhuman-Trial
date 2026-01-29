import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { SessionProvider } from "./lib/session-context";
import { TranscriptProvider } from "./lib/transcript-context";
import NavigationBar from "./components/NavigationBar";

const inter = Inter({ 
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Roleplay Body Language Analyser",
  description: "Analyse body language during roleplay sessions using Interhuman AI",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <SessionProvider>
          <TranscriptProvider>
            <NavigationBar />
            {children}
          </TranscriptProvider>
        </SessionProvider>
      </body>
    </html>
  );
}

