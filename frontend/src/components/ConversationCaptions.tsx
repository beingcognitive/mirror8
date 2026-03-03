"use client";

import { TranscriptEntry } from "@/lib/types";

interface ConversationCaptionsProps {
  entries: TranscriptEntry[];
  futureName: string;
}

export default function ConversationCaptions({
  entries,
  futureName,
}: ConversationCaptionsProps) {
  const lastAgent = [...entries].reverse().find((e) => e.role === "agent");
  const lastUser = [...entries].reverse().find((e) => e.role === "user");

  if (!lastAgent && !lastUser) return null;

  return (
    <div className="w-full max-w-lg mx-auto space-y-2 px-4">
      {lastAgent && (
        <div
          key={lastAgent.id}
          className="caption-fade-in bg-mirror-800/80 backdrop-blur-sm rounded-2xl px-4 py-3 border border-mirror-700/50"
        >
          <p className="text-xs text-accent mb-1 font-medium">{futureName}</p>
          <p className="text-sm text-mirror-100 line-clamp-4">
            {lastAgent.text}
          </p>
        </div>
      )}
      {lastUser && (
        <div
          key={lastUser.id}
          className="caption-fade-in flex justify-end"
        >
          <div className="bg-mirror-600/80 backdrop-blur-sm rounded-2xl px-4 py-2.5 border border-mirror-500/30 max-w-[80%]">
            <p className="text-sm text-white line-clamp-4">{lastUser.text}</p>
          </div>
        </div>
      )}
    </div>
  );
}
