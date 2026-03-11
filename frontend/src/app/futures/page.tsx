"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import FuturesGrid from "@/components/FuturesGrid";
import { GenerationResult } from "@/lib/types";
import { useAuth } from "@/components/AuthProvider";

export default function FuturesPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [data, setData] = useState<GenerationResult | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/");
      return;
    }

    const stored = sessionStorage.getItem("mirror8_session");
    if (stored) {
      setData(JSON.parse(stored));
    } else if (!loading) {
      router.push("/upload");
    }
  }, [router, loading, user]);

  const handleSelect = (futureId: string) => {
    if (data) {
      router.push(`/mirror/${futureId}?session=${data.sessionId}`);
    }
  };

  if (loading || !user || !data) return null;

  return (
    <main className="min-h-screen flex flex-col">
      <nav className="flex items-center justify-between px-6 py-4">
        <Link href="/" className="text-xl font-bold gradient-text">
          Mirror8
        </Link>
        <Link
          href="/upload"
          className="px-4 py-2 rounded-full border border-mirror-600 text-mirror-200 hover:bg-mirror-800 transition text-sm"
        >
          New Selfie
        </Link>
      </nav>

      <div className="flex-1 px-6 py-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-2">
            Your <span className="gradient-text">8 Futures</span>
          </h1>
          <p className="text-mirror-300 max-w-lg mx-auto">
            Each portrait is a possible version of you, 1-2 years from now.
            Choose one to start a live conversation.
          </p>
        </div>
        <FuturesGrid
          futures={data.futures}
          sessionId={data.sessionId}
          onSelect={handleSelect}
        />
      </div>
    </main>
  );
}
