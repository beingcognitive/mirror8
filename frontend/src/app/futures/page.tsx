"use client";

import { Suspense, useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import FuturesGrid from "@/components/FuturesGrid";
import SharePanel from "@/components/SharePanel";
import { GenerationResult } from "@/lib/types";
import { useAuth } from "@/components/AuthProvider";
import { getMySessions, getSession, SessionSummary } from "@/lib/api";

function formatSessionDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function ChevronLeft({ className }: { className?: string }) {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

function ChevronRight({ className }: { className?: string }) {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

export default function FuturesPage() {
  return (
    <Suspense>
      <FuturesPageContent />
    </Suspense>
  );
}

function FuturesPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedSessionId = searchParams.get("session");
  const { user, loading, getAccessToken } = useAuth();

  // All sessions for this user (most recent first)
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  // Index into sessions array: 0 = most recent
  const [currentIndex, setCurrentIndex] = useState(0);
  // The loaded session data for display
  const [data, setData] = useState<GenerationResult | null>(null);
  // Cache of loaded sessions by id
  const [cache, setCache] = useState<Record<string, GenerationResult>>({});
  // Loading state for session fetching
  const [loadingSession, setLoadingSession] = useState(false);
  // Transition direction for animation
  const [slideDirection, setSlideDirection] = useState<"left" | "right" | null>(
    null,
  );
  const [shareOpen, setShareOpen] = useState(false);

  // Load session list and current session data on mount
  useEffect(() => {
    if (loading || !user) {
      if (!loading && !user) router.push("/");
      return;
    }

    const stored = sessionStorage.getItem("mirror8_session");
    if (stored) {
      const parsed: GenerationResult = JSON.parse(stored);
      setData(parsed);
      setCache((prev) => ({ ...prev, [parsed.sessionId]: parsed }));
    }

    // Fetch all sessions in background
    (async () => {
      const token = await getAccessToken();
      if (!token) return;
      try {
        const allSessions = await getMySessions(token);
        setSessions(allSessions);

        // If a specific session was requested via URL param, navigate to it
        if (requestedSessionId && allSessions.length > 0) {
          const targetIndex = allSessions.findIndex((s) => s.id === requestedSessionId);
          if (targetIndex >= 0) {
            setCurrentIndex(targetIndex);
            // Load it if not already the displayed session
            if (!data || data.sessionId !== requestedSessionId) {
              const sessionData = await getSession(requestedSessionId, token);
              setData(sessionData);
              setCache((prev) => ({ ...prev, [sessionData.sessionId]: sessionData }));
            }
            return;
          }
        }

        // If no stored session but we have history, load the most recent
        if (!stored && allSessions.length > 0) {
          const latest = allSessions[0];
          const sessionData = await getSession(latest.id, token);
          setData(sessionData);
          setCache((prev) => ({ ...prev, [sessionData.sessionId]: sessionData }));
        } else if (!stored && allSessions.length === 0) {
          router.push("/upload");
        }
      } catch (e) {
        console.error("[Mirror8] Failed to fetch sessions:", e);
        // If we have stored data, we're fine; otherwise redirect
        if (!stored) router.push("/upload");
      }
    })();
  }, [router, loading, user, getAccessToken, requestedSessionId]);

  const navigateTo = useCallback(
    async (index: number, direction: "left" | "right") => {
      if (index < 0 || index >= sessions.length || loadingSession) return;

      const targetSession = sessions[index];
      setSlideDirection(direction);
      setCurrentIndex(index);

      // Check cache first
      if (cache[targetSession.id]) {
        setData(cache[targetSession.id]);
        return;
      }

      // Fetch from API
      setLoadingSession(true);
      try {
        const token = await getAccessToken();
        if (!token) return;
        const sessionData = await getSession(targetSession.id, token);
        setCache((prev) => ({ ...prev, [sessionData.sessionId]: sessionData }));
        setData(sessionData);
      } catch (e) {
        console.error("[Mirror8] Failed to load session:", e);
      } finally {
        setLoadingSession(false);
      }
    },
    [sessions, cache, loadingSession, getAccessToken],
  );

  const goOlder = useCallback(() => {
    navigateTo(currentIndex + 1, "left");
  }, [currentIndex, navigateTo]);

  const goNewer = useCallback(() => {
    navigateTo(currentIndex - 1, "right");
  }, [currentIndex, navigateTo]);

  const handleSelect = (futureId: string) => {
    if (data) {
      router.push(`/mirror/${futureId}?session=${data.sessionId}`);
    }
  };

  if (loading || !user || !data) return null;

  const isLatest = currentIndex === 0;
  const isOldest = currentIndex === sessions.length - 1;
  const hasMultipleSessions = sessions.length > 1;
  const currentSession = sessions[currentIndex];

  return (
    <main className="min-h-screen flex flex-col">
      <nav className="flex items-center justify-between px-6 py-4">
        <Link href="/" className="text-xl font-bold gradient-text">
          Mirror8
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href="/upload"
            className="px-4 py-2 rounded-full border border-mirror-600 text-mirror-200 hover:bg-mirror-800 transition text-sm"
          >
            New Selfie
          </Link>
          {data && (
            <button
              onClick={() => setShareOpen(true)}
              className="px-4 py-2 rounded-full border border-mirror-600 text-mirror-200 hover:bg-mirror-800 transition text-sm flex items-center gap-1.5"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M7 17l9.2-9.2M17 17V7H7" />
              </svg>
              Share
            </button>
          )}
        </div>
      </nav>

      <div className="flex-1 px-6 py-8">
        <div className="text-center mb-8">
          {/* Session navigation */}
          <div className="flex items-center justify-center gap-4 mb-2">
            {hasMultipleSessions && (
              <button
                onClick={goOlder}
                disabled={isOldest || loadingSession}
                className={`p-2 rounded-full transition-all duration-200 ${
                  isOldest || loadingSession
                    ? "text-mirror-700 cursor-default"
                    : "text-mirror-400 hover:text-accent hover:bg-mirror-800/60"
                }`}
                aria-label="Older session"
              >
                <ChevronLeft />
              </button>
            )}

            <div className="min-w-0">
              <h1 className="text-3xl md:text-4xl font-bold">
                Your <span className="gradient-text">8 Futures</span>
              </h1>
              {/* Show date only for non-latest sessions */}
              {hasMultipleSessions && !isLatest && currentSession && (
                <p className="text-mirror-400 text-sm mt-1 session-date-fade">
                  {formatSessionDate(currentSession.created_at)}
                </p>
              )}
            </div>

            {hasMultipleSessions && (
              <button
                onClick={goNewer}
                disabled={isLatest || loadingSession}
                className={`p-2 rounded-full transition-all duration-200 ${
                  isLatest || loadingSession
                    ? "text-mirror-700 cursor-default"
                    : "text-mirror-400 hover:text-accent hover:bg-mirror-800/60"
                }`}
                aria-label="Newer session"
              >
                <ChevronRight />
              </button>
            )}
          </div>

          <p className="text-mirror-300 max-w-lg mx-auto">
            {isLatest
              ? "Each portrait is a possible version of you, 1-2 years from now. Choose one to start a live conversation."
              : "A glimpse into the futures you once imagined."}
          </p>
        </div>

        {/* Grid with transition */}
        <div
          key={data.sessionId}
          className={`grid-transition ${slideDirection === "left" ? "slide-in-left" : slideDirection === "right" ? "slide-in-right" : "slide-in-fade"}`}
          onAnimationEnd={() => setSlideDirection(null)}
        >
          {loadingSession ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <FuturesGrid
              futures={data.futures}
              sessionId={data.sessionId}
              onSelect={handleSelect}
            />
          )}
        </div>
      </div>

      {data && (
        <SharePanel
          sessionId={data.sessionId}
          open={shareOpen}
          onClose={() => setShareOpen(false)}
        />
      )}
    </main>
  );
}
