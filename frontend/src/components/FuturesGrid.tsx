"use client";

import { FuturePersona } from "@/lib/types";
import FutureCard from "./FutureCard";

interface FuturesGridProps {
  futures: FuturePersona[];
  sessionId: string;
  onSelect: (futureId: string) => void;
}

export default function FuturesGrid({
  futures,
  sessionId,
  onSelect,
}: FuturesGridProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 max-w-6xl mx-auto w-full">
      {futures.map((future) => (
        <FutureCard
          key={future.id}
          future={future}
          sessionId={sessionId}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}
