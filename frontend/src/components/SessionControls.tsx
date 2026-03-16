"use client";

import { ConnectionStatus } from "@/lib/types";
import AudioVisualizer from "./AudioVisualizer";

interface SessionControlsProps {
  status: ConnectionStatus;
  micLevel: number;
  isMicOn: boolean;
  isCameraOn: boolean;
  interruptLevel: number;
  onStart: () => void;
  onEnd: () => void;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onInterruptLevelChange: (level: number) => void;
  autoStarting?: boolean;
}

export default function SessionControls({
  status,
  micLevel,
  isMicOn,
  isCameraOn,
  interruptLevel,
  onStart,
  onEnd,
  onToggleMic,
  onToggleCamera,
  onInterruptLevelChange,
  autoStarting,
}: SessionControlsProps) {
  const isActive = status === "active";

  // Hide controls while auto-start is attempting (overlay handles it)
  if (autoStarting && !isActive) return null;

  return (
    <div className="flex flex-col items-center gap-4">
      {status === "idle" || status === "ended" || status === "error" ? (
        <button
          onClick={onStart}
          className="px-8 py-3 rounded-full bg-accent text-mirror-900 font-semibold hover:bg-accent-dim transition"
        >
          {status === "error" ? "Retry Connection" : "Start Conversation"}
        </button>
      ) : status === "connecting" || status === "permissions" ? (
        <div className="px-8 py-3 rounded-full bg-mirror-700 text-mirror-300 font-medium">
          {status === "permissions" ? "Requesting access..." : "Connecting..."}
        </div>
      ) : (
        <div className="flex items-center justify-center gap-4">
          {/* Mic toggle */}
          <button
            onClick={onToggleMic}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition ${
              isMicOn
                ? "bg-mirror-600 hover:bg-mirror-500"
                : "bg-red-900/50 hover:bg-red-900/70 border border-red-700"
            }`}
            title={isMicOn ? "Mute" : "Unmute"}
          >
            {isMicOn ? "🎙️" : "🔇"}
          </button>

          {/* Mic level */}
          {isActive && (
            <AudioVisualizer level={micLevel} isActive={isMicOn} />
          )}

          {/* Camera toggle */}
          <button
            onClick={onToggleCamera}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition ${
              isCameraOn
                ? "bg-mirror-600 hover:bg-mirror-500"
                : "bg-red-900/50 hover:bg-red-900/70 border border-red-700"
            }`}
            title={isCameraOn ? "Turn off camera" : "Turn on camera"}
          >
            {isCameraOn ? "📷" : "🚫"}
          </button>

          {/* End */}
          <button
            onClick={onEnd}
            className="w-12 h-12 rounded-full bg-red-600 hover:bg-red-500 flex items-center justify-center transition"
            title="End session"
          >
            ✕
          </button>
        </div>
      )}

      {isActive && (
        <div className="w-full max-w-xs">
          <div className="flex items-center justify-between text-xs text-mirror-400 mb-2">
            <span>Interrupt threshold</span>
            <span>{Math.round(interruptLevel * 100)}%</span>
          </div>
          <input
            type="range"
            min="0.08"
            max="0.24"
            step="0.01"
            value={interruptLevel}
            onChange={(e) => onInterruptLevelChange(Number(e.target.value))}
            className="w-full accent-accent"
            aria-label="Interrupt threshold"
          />
          <p className="mt-1 text-[11px] text-mirror-500">
            Raise this if small noises keep interrupting the future self.
          </p>
        </div>
      )}
    </div>
  );
}
