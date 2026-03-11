"use client";

import { useState, useEffect } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import MirrorRoom from "@/components/MirrorRoom";
import { FuturePersona, GenerationResult } from "@/lib/types";
import { getSession, getConversationsForFuture, Conversation } from "@/lib/api";
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
  const [pastConversations, setPastConversations] = useState<Conversation[]>([]);

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
    getAccessToken().then((token) => {
      if (!token) return;
      setAccessToken(token);

      // Fetch past conversations in parallel with session data
      getConversationsForFuture(sessionId, futureId, token).then(
        setPastConversations,
      );
    });

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
    <main className="relative min-h-screen">
      {/* Minimal overlay header — just a back arrow */}
      <div className="absolute top-0 left-0 right-0 z-20 p-4">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-full bg-mirror-800/60 backdrop-blur-sm text-mirror-300 hover:text-mirror-100 hover:bg-mirror-800/80 transition text-sm"
        >
          <span>&#8592;</span>
          <span>Back</span>
        </button>
      </div>
      <MirrorRoom
        sessionId={sessionId}
        future={future}
        accessToken={accessToken}
        pastConversations={pastConversations}
      />
    </main>
  );
}
