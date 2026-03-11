import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "Mirror8 — Meet Your Future Self",
  description:
    "Upload a selfie, AI generates 8 future-self portraits, then have a real-time voice conversation with your future self. Powered by Gemini Live API.",
  keywords: ["AI", "future self", "voice conversation", "Gemini", "selfie"],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} min-h-screen bg-mirror-900 text-mirror-100 antialiased font-sans`}
      >
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
