import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Document Auto-Triage",
  description: "Automatically classify documents for investment memos using AI",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
