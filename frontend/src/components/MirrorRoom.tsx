"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  ConnectionStatus,
  TranscriptEntry,
  AvatarMood,
  FuturePersona,
  WSServerMessage,
} from "@/lib/types";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useAudioCapture } from "@/hooks/useAudioCapture";
import { useAudioPlayback } from "@/hooks/useAudioPlayback";
import { useCameraCapture } from "@/hooks/useCameraCapture";
import FutureAvatar from "./FutureAvatar";
import CameraPreview from "./CameraPreview";
import ConversationCaptions from "./ConversationCaptions";
import SessionControls from "./SessionControls";

interface MirrorRoomProps {
  sessionId: string;
  future: FuturePersona;
  accessToken: string;
}

let entryCounter = 0;

export default function MirrorRoom({ sessionId, future, accessToken }: MirrorRoomProps) {
  const [status, setStatus] = useState<ConnectionStatus>("idle");
  const [transcripts, setTranscripts] = useState<TranscriptEntry[]>([]);
  const [micLevel, setMicLevel] = useState(0);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [mood, setMood] = useState<AvatarMood>("idle");
  const [autoStartFailed, setAutoStartFailed] = useState(false);
  const [currentPortraitUrl, setCurrentPortraitUrl] = useState(future.portraitUrl || null);
  const cameraVideoRef = useRef<HTMLVideoElement>(null);
  const hasAttemptedAutoStart = useRef(false);

  // Pending transcript aggregation
  const pendingAgentText = useRef("");
  const pendingUserText = useRef("");

  const addTranscript = useCallback(
    (role: "user" | "agent", text: string) => {
      setTranscripts((prev) => {
        // Merge with last entry of same role
        if (prev.length > 0 && prev[prev.length - 1].role === role) {
          const updated = [...prev];
          updated[updated.length - 1] = {
            ...updated[updated.length - 1],
            text: updated[updated.length - 1].text + " " + text,
          };
          return updated;
        }
        return [
          ...prev,
          {
            id: `entry-${++entryCounter}`,
            role,
            text,
            timestamp: Date.now(),
          },
        ];
      });
    },
    [],
  );

  // Audio playback
  const playback = useAudioPlayback();

  // WebSocket
  const ws = useWebSocket({
    onAudioData: (pcmData) => {
      playback.playChunk(pcmData);
      setMood("speaking");
    },
    onMessage: (msg: WSServerMessage) => {
      switch (msg.type) {
        case "transcript":
          if (msg.role === "agent") {
            pendingAgentText.current += " " + msg.text;
          } else {
            pendingUserText.current += " " + msg.text;
          }
          break;
        case "turn_complete":
          // Flush pending transcripts (user first — they spoke before agent responded)
          if (pendingUserText.current.trim()) {
            addTranscript("user", pendingUserText.current.trim());
            pendingUserText.current = "";
          }
          if (pendingAgentText.current.trim()) {
            addTranscript("agent", pendingAgentText.current.trim());
            pendingAgentText.current = "";
          }
          setMood("listening");
          break;
        case "interrupted":
          playback.clearBuffer();
          // Flush what we have so far (user first)
          if (pendingUserText.current.trim()) {
            addTranscript("user", pendingUserText.current.trim());
            pendingUserText.current = "";
          }
          if (pendingAgentText.current.trim()) {
            addTranscript("agent", pendingAgentText.current.trim());
            pendingAgentText.current = "";
          }
          setMood("listening");
          break;
        case "portrait_update":
          setCurrentPortraitUrl(msg.url);
          break;
      }
    },
    onStatusChange: setStatus,
  });

  // Audio capture
  const audioCapture = useAudioCapture({
    onAudioData: (pcm) => {
      if (isMicOn) ws.sendAudio(pcm);
    },
    onLevelChange: setMicLevel,
  });

  // Camera capture
  const cameraCapture = useCameraCapture({
    onFrame: (base64) => {
      if (isCameraOn) ws.sendImage(base64);
    },
    fps: 1,
  });

  const handleStart = useCallback(async () => {
    setStatus("permissions");

    // Initialize playback context (needs user gesture)
    playback.init();

    // Start audio capture
    await audioCapture.start();

    // Start camera capture
    if (cameraVideoRef.current) {
      await cameraCapture.start(cameraVideoRef.current);
    }

    // Connect WebSocket with auth token
    ws.connect(sessionId, future.id, accessToken);
    setMood("listening");
  }, [sessionId, future.id, accessToken, playback, audioCapture, cameraCapture, ws]);

  const handleEnd = useCallback(() => {
    audioCapture.stop();
    cameraCapture.stop();
    ws.disconnect();
    playback.close();
    setMood("idle");
  }, [audioCapture, cameraCapture, ws, playback]);

  const handleToggleMic = useCallback(() => {
    setIsMicOn((prev) => !prev);
  }, []);

  const handleToggleCamera = useCallback(() => {
    setIsCameraOn((prev) => !prev);
  }, []);

  // Auto-start on mount
  useEffect(() => {
    if (hasAttemptedAutoStart.current) return;
    hasAttemptedAutoStart.current = true;

    handleStart().catch(() => {
      setAutoStartFailed(true);
      setStatus("idle");
    });
  }, []);

  const showOverlay = autoStartFailed && status === "idle";

  return (
    <div className="relative h-screen flex flex-col bg-mirror-900">
      {/* Tap-to-begin overlay (shown when auto-start fails, e.g. iOS Safari) */}
      {showOverlay && (
        <div
          className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-mirror-900/95 backdrop-blur-sm cursor-pointer px-6"
          onClick={() => {
            setAutoStartFailed(false);
            handleStart().catch(() => {
              setAutoStartFailed(true);
              setStatus("idle");
            });
          }}
        >
          {/* Portrait */}
          <div className="w-48 h-48 md:w-64 md:h-64 rounded-full overflow-hidden border-2 border-mirror-500 avatar-idle mb-6">
            {currentPortraitUrl ? (
              <img
                src={currentPortraitUrl}
                alt={future.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-mirror-700 flex items-center justify-center text-4xl">
                🪞
              </div>
            )}
          </div>

          {/* Name & title */}
          <h2 className="text-2xl font-bold gradient-text mb-1">{future.name}</h2>
          <p className="text-mirror-300 text-sm mb-6">{future.title}</p>

          {/* Full backstory (not truncated) */}
          <p className="text-mirror-400 text-sm text-center max-w-md leading-relaxed mb-10">
            {future.backstory}
          </p>

          {/* CTA */}
          <div className="flex flex-col items-center gap-2">
            <div className="w-16 h-16 rounded-full bg-gradient-to-r from-mirror-500 to-accent-dim flex items-center justify-center">
              <span className="text-2xl">🎙️</span>
            </div>
            <p className="text-mirror-300 text-sm animate-pulse">
              Tap anywhere to begin
            </p>
          </div>
        </div>
      )}

      {/* Hero portrait section */}
      <div className="flex-1 flex flex-col items-center justify-center min-h-0 pt-16 pb-4">
        <FutureAvatar
          portraitUrl={currentPortraitUrl}
          name={future.name}
          mood={mood}
          heroMode
          title={future.title}
        />
      </div>

      {/* Captions area */}
      <div className="pb-2">
        <ConversationCaptions entries={transcripts} futureName={future.name} />
      </div>

      {/* PiP webcam */}
      <div className="absolute bottom-28 right-4 z-10">
        <CameraPreview
          ref={cameraVideoRef}
          isActive={isCameraOn && status === "active"}
          pipMode
        />
      </div>

      {/* Bottom controls */}
      <div className="p-4 pb-8">
        <SessionControls
          status={status}
          micLevel={micLevel}
          isMicOn={isMicOn}
          isCameraOn={isCameraOn}
          onStart={handleStart}
          onEnd={handleEnd}
          onToggleMic={handleToggleMic}
          onToggleCamera={handleToggleCamera}
          autoStarting={!autoStartFailed}
        />
      </div>
    </div>
  );
}
