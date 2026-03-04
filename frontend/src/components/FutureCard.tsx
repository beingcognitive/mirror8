"use client";

import { FuturePersona } from "@/lib/types";

interface FutureCardProps {
  future: FuturePersona;
  sessionId: string;
  onSelect: (futureId: string) => void;
}

export default function FutureCard({
  future,
  sessionId,
  onSelect,
}: FutureCardProps) {
  const portraitUrl = future.portraitUrl || null;

  return (
    <div className="future-card bg-mirror-800/60 rounded-2xl overflow-hidden border border-mirror-700 flex flex-col">
      {/* Portrait */}
      <div className="aspect-square bg-mirror-700 relative">
        {portraitUrl ? (
          <img
            src={portraitUrl}
            alt={future.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-mirror-500">
            <div className="text-5xl">🪞</div>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-4 flex flex-col flex-1">
        <h3 className="font-bold text-lg gradient-text">{future.name}</h3>
        <p className="text-mirror-300 text-sm mb-2">{future.title}</p>
        <div className="flex-1 max-h-20 overflow-y-auto mb-4 scrollbar-thin">
          <p className="text-mirror-400 text-xs">
            {future.backstory}
          </p>
        </div>
        <button
          onClick={() => onSelect(future.id)}
          className="w-full py-2.5 rounded-full bg-gradient-to-r from-mirror-500 to-accent-dim text-white font-medium text-sm hover:opacity-90 transition"
        >
          Talk to Me
        </button>
      </div>
    </div>
  );
}
