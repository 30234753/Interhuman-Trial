import type { Metadata } from "next";
import "./globals.css";
import { SessionProvider } from "./lib/session-context";
import NavigationBar from "./components/NavigationBar";

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
    <html lang="en">
      <body>
        <SessionProvider>
          <NavigationBar />
          {children}
        </SessionProvider>
      </body>
    </html>
  );
}

