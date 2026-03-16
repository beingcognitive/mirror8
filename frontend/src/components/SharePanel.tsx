"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "./AuthProvider";
import {
  enableSessionShare,
  disableSessionShare,
  getSessionShareStatus,
  ShareStatus,
} from "@/lib/api";

interface SharePanelProps {
  sessionId: string;
  open: boolean;
  onClose: () => void;
}

export default function SharePanel({ sessionId, open, onClose }: SharePanelProps) {
  const { getAccessToken } = useAuth();
  const [status, setStatus] = useState<ShareStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Fetch share status when panel opens
  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    (async () => {
      try {
        const token = await getAccessToken();
        if (!token || cancelled) return;
        const s = await getSessionShareStatus(sessionId, token);
        if (!cancelled) setStatus(s);
      } catch (e) {
        console.error("[Mirror8] Failed to fetch share status:", e);
        if (!cancelled) setStatus({ share_token: null, share_url: null, is_active: false });
      }
    })();

    return () => { cancelled = true; };
  }, [open, sessionId, getAccessToken]);

  const handleToggle = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getAccessToken();
      if (!token) return;

      if (status?.is_active) {
        await disableSessionShare(sessionId, token);
        setStatus({ share_token: null, share_url: null, is_active: false });
      } else {
        const s = await enableSessionShare(sessionId, token);
        setStatus(s);
      }
    } catch (e) {
      console.error("[Mirror8] Failed to toggle sharing:", e);
    } finally {
      setLoading(false);
    }
  }, [status, sessionId, getAccessToken]);

  const handleCopy = useCallback(async () => {
    if (!status?.share_url) return;
    try {
      await navigator.clipboard.writeText(status.share_url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const input = document.createElement("input");
      input.value = status.share_url;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [status]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 z-40"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed bottom-0 left-0 right-0 z-50 share-panel-slide-up">
        <div className="max-w-lg mx-auto bg-mirror-800 rounded-t-2xl border border-mirror-600 border-b-0 p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-mirror-100">Share Session</h2>
            <button
              onClick={onClose}
              className="text-mirror-400 hover:text-mirror-200 transition p-1"
              aria-label="Close"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Toggle */}
          <div className="flex items-center justify-between mb-4">
            <span className="text-mirror-200 text-sm">Share publicly</span>
            <button
              onClick={handleToggle}
              disabled={loading || !status}
              className={`relative w-12 h-7 rounded-full transition-colors duration-200 ${
                status?.is_active ? "bg-accent" : "bg-mirror-600"
              } ${loading ? "opacity-50" : ""}`}
              aria-label="Toggle sharing"
            >
              <span
                className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform duration-200 ${
                  status?.is_active ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          {/* Status / URL */}
          {status?.is_active && status.share_url ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 bg-mirror-900 rounded-lg p-3">
                <span className="text-mirror-300 text-sm truncate flex-1 select-all">
                  {status.share_url}
                </span>
                <button
                  onClick={handleCopy}
                  className="shrink-0 px-3 py-1.5 rounded-lg bg-accent text-mirror-900 text-sm font-medium hover:bg-accent-dim transition"
                >
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
              <p className="text-mirror-500 text-xs">
                Anyone with this link can see your 8 futures grid.
              </p>
            </div>
          ) : (
            <p className="text-mirror-500 text-sm">
              This session is private. Enable sharing to get a public link.
            </p>
          )}
        </div>
      </div>
    </>
  );
}
