"use client";

import { GenerationProgress as ProgressEvent } from "@/lib/api";

interface GenerationProgressProps {
  event: ProgressEvent | null;
  error?: string | null;
  retryable?: boolean;
  onRetry?: () => void;
}

function getStepInfo(event: ProgressEvent | null): {
  message: string;
  progress: number;
} {
  if (!event) {
    return { message: "Starting...", progress: 2 };
  }

  switch (event.type) {
    case "analyzing":
      return { message: "Studying your features and imagining your futures...", progress: 10 };
    case "analysis_complete":
      return { message: "Your stories are written. Now painting your portraits...", progress: 25 };
    case "portraits_starting":
      return { message: "Starting portrait generation...", progress: 28 };
    case "portrait_done": {
      const index = event.index || 0;
      const total = event.total || 8;
      const base = 30;
      const portraitProgress = base + ((index / total) * 60);
      const name = event.name || `Future ${index}`;
      return {
        message: `${name} has arrived (${index}/${total})`,
        progress: portraitProgress,
      };
    }
    case "storing":
      return { message: "Saving your futures...", progress: 95 };
    case "complete":
      return { message: "Done!", progress: 100 };
    default:
      return { message: "Working...", progress: 15 };
  }
}

export default function GenerationProgress({
  event,
  error,
  retryable,
  onRetry,
}: GenerationProgressProps) {
  const { message, progress } = getStepInfo(event);

  return (
    <div className="flex flex-col items-center gap-8 text-center max-w-md mx-auto">
      {/* Animated orb */}
      <div className="relative w-32 h-32">
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-mirror-500 to-accent opacity-30 animate-ping" />
        <div className="absolute inset-4 rounded-full bg-gradient-to-br from-mirror-500 to-accent opacity-60 animate-pulse" />
        <div className="absolute inset-8 rounded-full bg-gradient-to-br from-mirror-400 to-accent" />
      </div>

      <h2 className="text-2xl font-bold gradient-text">Creating Your Futures</h2>

      <p className="text-mirror-200 text-lg">{message}</p>

      {/* Progress bar */}
      <div className="w-full h-2 bg-mirror-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-mirror-500 to-accent transition-all duration-700 ease-out rounded-full"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Error overlay */}
      {error && (
        <div className="w-full px-4 py-4 bg-red-900/30 border border-red-800 rounded-xl text-center">
          <p className="text-red-300 text-sm">{error}</p>
          {retryable && onRetry && (
            <button
              onClick={onRetry}
              className="mt-3 px-6 py-2 rounded-full bg-gradient-to-r from-mirror-500 to-accent-dim text-white font-semibold hover:opacity-90 transition text-sm"
            >
              Try Again
            </button>
          )}
        </div>
      )}

      {!error && (
        <p className="text-mirror-500 text-sm">
          This may take a minute. Your 8 future selves are being imagined...
        </p>
      )}
    </div>
  );
}
