"use client";

import { useRef, useEffect } from "react";
import { TranscriptEntry } from "@/lib/types";

interface ConversationCaptionsProps {
  entries: TranscriptEntry[];
  futureName: string;
}

export default function ConversationCaptions({
  entries,
  futureName,
}: ConversationCaptionsProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const pastEntries = entries.filter((e) => e.isPast);
  const liveEntries = entries.filter((e) => !e.isPast);
  const hasPast = pastEntries.length > 0;

  // Show last few past entries for context + all live entries
  const visiblePast = pastEntries.slice(-4);

  const lastAgent = [...liveEntries].reverse().find((e) => e.role === "agent");
  const lastUser = [...liveEntries].reverse().find((e) => e.role === "user");

  // Auto-scroll to bottom when new live entries appear
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries.length]);

  if (!lastAgent && !lastUser && !hasPast) return null;

  return (
    <div
      ref={scrollRef}
      className="w-full max-w-lg mx-auto space-y-2 px-4 max-h-40 overflow-y-auto scrollbar-hide"
    >
      {/* Past conversation entries (dimmed) */}
      {hasPast && visiblePast.map((entry) => (
        <div
          key={entry.id}
          className={`${entry.role === "user" ? "flex justify-end" : ""}`}
        >
          {entry.role === "user" ? (
            <div className="bg-mirror-700/40 rounded-2xl px-4 py-2 max-w-[80%] opacity-40">
              <p className="text-xs text-mirror-300">{entry.text}</p>
            </div>
          ) : (
            <div className="bg-mirror-800/40 rounded-2xl px-4 py-2 border border-mirror-700/30 opacity-40">
              <p className="text-xs text-accent/60 mb-0.5 font-medium">{futureName}</p>
              <p className="text-xs text-mirror-300">{entry.text}</p>
            </div>
          )}
        </div>
      ))}
      {hasPast && (
        <div className="flex items-center gap-3 py-1">
          <div className="flex-1 h-px bg-mirror-700/50" />
          <span className="text-[10px] text-mirror-500 uppercase tracking-wider">now</span>
          <div className="flex-1 h-px bg-mirror-700/50" />
        </div>
      )}

      {/* Live conversation entries */}
      {lastUser && (
        <div
          key={lastUser.id}
          className="caption-fade-in flex justify-end"
        >
          <div className="bg-mirror-600/80 backdrop-blur-sm rounded-2xl px-4 py-2.5 border border-mirror-500/30 max-w-[80%]">
            <p className="text-sm text-mirror-100">{lastUser.text}</p>
          </div>
        </div>
      )}
      {lastAgent && (
        <div
          key={lastAgent.id}
          className="caption-fade-in bg-mirror-800/80 backdrop-blur-sm rounded-2xl px-4 py-3 border border-mirror-700/50"
        >
          <p className="text-xs text-accent mb-1 font-medium">{futureName}</p>
          <p className="text-sm text-mirror-100">
            {lastAgent.text}
          </p>
        </div>
      )}
    </div>
  );
}
