import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";

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
      <body className="min-h-screen bg-mirror-900 text-white antialiased">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
