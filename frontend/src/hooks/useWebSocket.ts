"use client";

import { useRef, useCallback, useState, useEffect } from "react";
import { ConnectionStatus, WSServerMessage } from "@/lib/types";

interface UseWebSocketOptions {
  onAudioData: (pcmData: ArrayBuffer) => void;
  onMessage: (msg: WSServerMessage) => void;
  onStatusChange?: (status: ConnectionStatus) => void;
}

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8080";
const PING_INTERVAL = 30000;

export function useWebSocket({
  onAudioData,
  onMessage,
  onStatusChange,
}: UseWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const pingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>("idle");
  const onAudioDataRef = useRef(onAudioData);
  const onMessageRef = useRef(onMessage);

  useEffect(() => {
    onAudioDataRef.current = onAudioData;
    onMessageRef.current = onMessage;
  }, [onAudioData, onMessage]);

  const updateStatus = useCallback(
    (s: ConnectionStatus) => {
      setStatus(s);
      onStatusChange?.(s);
    },
    [onStatusChange],
  );

  const connect = useCallback(
    (sessionId: string, futureId: string, accessToken: string) => {
      updateStatus("connecting");
      const url = `${WS_URL}/ws/mirror/${sessionId}/${futureId}?token=${encodeURIComponent(accessToken)}`;
      const ws = new WebSocket(url);
      ws.binaryType = "arraybuffer";

      ws.onopen = () => {
        updateStatus("active");
        // Start keep-alive pings
        pingRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "ping" }));
          }
        }, PING_INTERVAL);
      };

      ws.onmessage = (event) => {
        if (event.data instanceof ArrayBuffer) {
          onAudioDataRef.current(event.data);
        } else {
          try {
            const msg: WSServerMessage = JSON.parse(event.data);
            onMessageRef.current(msg);
          } catch {
            // Ignore invalid JSON
          }
        }
      };

      ws.onclose = () => {
        if (pingRef.current) clearInterval(pingRef.current);
        updateStatus("ended");
      };

      ws.onerror = () => {
        updateStatus("error");
      };

      wsRef.current = ws;
    },
    [updateStatus],
  );

  const sendAudio = useCallback((pcmData: ArrayBuffer) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(pcmData);
    }
  }, []);

  const sendImage = useCallback((base64: string, mimeType = "image/jpeg") => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "image", data: base64, mimeType }));
    }
  }, []);

  const sendText = useCallback((text: string) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "text", text }));
    }
  }, []);

  const disconnect = useCallback(() => {
    if (pingRef.current) clearInterval(pingRef.current);
    wsRef.current?.close();
    wsRef.current = null;
  }, []);

  return { connect, disconnect, sendAudio, sendImage, sendText, status };
}
