"use client";

import { useRef, useEffect } from "react";
import { TranscriptEntry } from "@/lib/types";

interface TranscriptPanelProps {
  entries: TranscriptEntry[];
  futureName: string;
}

export default function TranscriptPanel({
  entries,
  futureName,
}: TranscriptPanelProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [entries]);

  if (entries.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-mirror-500 text-sm">
        Conversation will appear here...
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto space-y-3 pr-2">
      {entries.map((entry) => (
        <div
          key={entry.id}
          className={`flex ${entry.role === "user" ? "justify-end" : "justify-start"}`}
        >
          <div
            className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm ${
              entry.role === "user"
                ? "bg-mirror-600 text-mirror-100 rounded-br-sm"
                : "bg-mirror-800 border border-mirror-700 text-mirror-100 rounded-bl-sm"
            }`}
          >
            {entry.role === "agent" && (
              <p className="text-xs text-accent mb-1 font-medium">
                {futureName}
              </p>
            )}
            <p>{entry.text}</p>
          </div>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
