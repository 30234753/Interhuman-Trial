import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Roleplay Body Language Analyzer",
  description: "Analyze body language during roleplay sessions using Interhuman AI",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

