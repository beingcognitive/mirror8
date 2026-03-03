"use client";

import { useState, useCallback, useRef } from "react";
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
import TranscriptPanel from "./TranscriptPanel";
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
  const cameraVideoRef = useRef<HTMLVideoElement>(null);

  const portraitUrl = future.portraitUrl || null;

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
    try {
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
    } catch (err) {
      console.error("Failed to start session:", err);
      setStatus("error");
    }
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

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      {/* Main content area */}
      <div className="flex-1 flex flex-col md:flex-row gap-4 p-4 min-h-0">
        {/* Left: Avatar + Camera */}
        <div className="flex flex-col items-center gap-4 md:w-1/3">
          <FutureAvatar
            portraitUrl={portraitUrl}
            name={future.name}
            mood={mood}
          />
          <p className="text-mirror-400 text-sm text-center">
            {future.title}
          </p>
          <CameraPreview
            ref={cameraVideoRef}
            isActive={isCameraOn && status === "active"}
          />
        </div>

        {/* Right: Transcript */}
        <div className="flex-1 flex flex-col min-h-0 bg-mirror-800/30 rounded-2xl border border-mirror-700 p-4">
          <h3 className="text-sm font-medium text-mirror-400 mb-3">
            Conversation
          </h3>
          <TranscriptPanel entries={transcripts} futureName={future.name} />
        </div>
      </div>

      {/* Bottom: Controls */}
      <div className="p-4 border-t border-mirror-800">
        <SessionControls
          status={status}
          micLevel={micLevel}
          isMicOn={isMicOn}
          isCameraOn={isCameraOn}
          onStart={handleStart}
          onEnd={handleEnd}
          onToggleMic={handleToggleMic}
          onToggleCamera={handleToggleCamera}
        />
      </div>
    </div>
  );
}
