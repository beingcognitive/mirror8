"use client";

import { useState, useEffect } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import MirrorRoom from "@/components/MirrorRoom";
import { FuturePersona, GenerationResult } from "@/lib/types";
import { getSession } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";

export default function MirrorPageClient() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, loading: authLoading, getAccessToken } = useAuth();
  const futureId = params.futureId as string;
  const sessionId = searchParams.get("session");

  const [future, setFuture] = useState<FuturePersona | null>(null);
  const [loading, setLoading] = useState(true);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/");
      return;
    }

    if (authLoading || !user) return;

    if (!sessionId) {
      router.push("/upload");
      return;
    }

    // Get access token for WebSocket
    getAccessToken().then(setAccessToken);

    // Try sessionStorage first
    const stored = sessionStorage.getItem("mirror8_session");
    if (stored) {
      const data: GenerationResult = JSON.parse(stored);
      if (data.sessionId === sessionId) {
        const found = data.futures.find((f) => f.id === futureId);
        if (found) {
          setFuture(found);
          setLoading(false);
          return;
        }
      }
    }

    // Fallback: fetch from API
    getAccessToken().then((token) => {
      if (!token) return;
      getSession(sessionId, token)
        .then((data) => {
          const found = data.futures.find((f) => f.id === futureId);
          if (found) {
            setFuture(found);
          } else {
            router.push("/futures");
          }
        })
        .catch(() => router.push("/upload"))
        .finally(() => setLoading(false));
    });
  }, [sessionId, futureId, router, authLoading, user, getAccessToken]);

  if (authLoading || loading || !future || !sessionId || !accessToken) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-mirror-400">Loading...</div>
      </div>
    );
  }

  return (
    <main className="min-h-screen flex flex-col">
      <nav className="flex items-center justify-between px-6 py-4 border-b border-mirror-800">
        <Link href="/" className="text-xl font-bold gradient-text">
          Mirror8
        </Link>
        <Link
          href="/futures"
          className="px-4 py-2 rounded-full border border-mirror-600 text-mirror-200 hover:bg-mirror-800 transition text-sm"
        >
          Back to Futures
        </Link>
      </nav>
      <MirrorRoom sessionId={sessionId} future={future} accessToken={accessToken} />
    </main>
  );
}
