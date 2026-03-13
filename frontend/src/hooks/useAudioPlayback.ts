"use client";

import { useRef, useCallback, useState } from "react";

export function useAudioPlayback() {
  const contextRef = useRef<AudioContext | null>(null);
  const nextTimeRef = useRef(0);
  const generationRef = useRef(0); // Incremented on clear to drop stale chunks
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

    // Capture generation at time of call — if it changes, this chunk is stale
    const gen = generationRef.current;

    // Int16 → Float32
    const int16 = new Int16Array(pcmData);
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) {
      float32[i] = int16[i] / 32768;
    }

    // Drop chunk if a clear happened while we were decoding
    if (gen !== generationRef.current) return;

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
      if (gen !== generationRef.current) return;
      if (ctx.currentTime >= nextTimeRef.current - 0.01) {
        setIsPlaying(false);
      }
    };
  }, []);

  const clearBuffer = useCallback(() => {
    // Bump generation so in-flight chunks are dropped
    generationRef.current++;
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
