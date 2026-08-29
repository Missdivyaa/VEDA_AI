import type { Metadata } from "next";
import "./globals.css";

// System font stack only (see globals.css) — no next/font/google, so the build
// never needs network access to fonts.googleapis.com.

export const metadata: Metadata = {
  title: "VedaAI · Exams",
  description:
    "Upload a question paper and a student's handwritten answer sheet to map, highlight and grade every answer with AI.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-page-bg text-ink">{children}</body>
    </html>
  );
}
