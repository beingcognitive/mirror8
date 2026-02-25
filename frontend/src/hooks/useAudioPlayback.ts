"use client";

import { useRef, useCallback, useState } from "react";

export function useAudioPlayback() {
  const contextRef = useRef<AudioContext | null>(null);
  const nextTimeRef = useRef(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const init = useCallback(() => {
    if (!contextRef.current) {
      contextRef.current = new AudioContext({ sampleRate: 24000 });
      nextTimeRef.current = 0;
    }
  }, []);

  const playChunk = useCallback((pcmData: ArrayBuffer) => {
    const ctx = contextRef.current;
    if (!ctx) return;

    // Int16 → Float32
    const int16 = new Int16Array(pcmData);
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) {
      float32[i] = int16[i] / 32768;
    }

    const buffer = ctx.createBuffer(1, float32.length, 24000);
    buffer.getChannelData(0).set(float32);

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);

    const now = ctx.currentTime;
    const startTime = Math.max(now, nextTimeRef.current);
    source.start(startTime);
    nextTimeRef.current = startTime + buffer.duration;

    setIsPlaying(true);
    source.onended = () => {
      if (ctx.currentTime >= nextTimeRef.current - 0.01) {
        setIsPlaying(false);
      }
    };
  }, []);

  const clearBuffer = useCallback(() => {
    // Reset scheduling to interrupt current playback
    if (contextRef.current) {
      contextRef.current.close();
      contextRef.current = new AudioContext({ sampleRate: 24000 });
      nextTimeRef.current = 0;
      setIsPlaying(false);
    }
  }, []);

  const close = useCallback(() => {
    contextRef.current?.close();
    contextRef.current = null;
    nextTimeRef.current = 0;
    setIsPlaying(false);
  }, []);

  return { init, playChunk, clearBuffer, close, isPlaying };
}
