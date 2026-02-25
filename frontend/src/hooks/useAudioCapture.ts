"use client";

import { useRef, useCallback, useState, useEffect } from "react";

interface UseAudioCaptureOptions {
  onAudioData: (pcmData: ArrayBuffer) => void;
  onLevelChange?: (level: number) => void;
}

export function useAudioCapture({
  onAudioData,
  onLevelChange,
}: UseAudioCaptureOptions) {
  const contextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const workletRef = useRef<AudioWorkletNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number>(0);
  const [isCapturing, setIsCapturing] = useState(false);
  const onAudioDataRef = useRef(onAudioData);
  const onLevelChangeRef = useRef(onLevelChange);

  useEffect(() => {
    onAudioDataRef.current = onAudioData;
    onLevelChangeRef.current = onLevelChange;
  }, [onAudioData, onLevelChange]);

  const start = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        sampleRate: 16000,
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    const ctx = new AudioContext({ sampleRate: 16000 });
    await ctx.audioWorklet.addModule("/worklets/capture.worklet.js");

    const source = ctx.createMediaStreamSource(stream);
    const worklet = new AudioWorkletNode(ctx, "capture-processor");

    worklet.port.onmessage = (e: MessageEvent<ArrayBuffer>) => {
      onAudioDataRef.current(e.data);
    };

    // Analyser for mic level visualization
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    source.connect(worklet);

    contextRef.current = ctx;
    streamRef.current = stream;
    workletRef.current = worklet;
    analyserRef.current = analyser;
    setIsCapturing(true);

    // Level monitoring loop
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    const monitorLevel = () => {
      analyser.getByteFrequencyData(dataArray);
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
      const avg = sum / dataArray.length / 255;
      onLevelChangeRef.current?.(avg);
      animFrameRef.current = requestAnimationFrame(monitorLevel);
    };
    monitorLevel();
  }, []);

  const stop = useCallback(() => {
    cancelAnimationFrame(animFrameRef.current);
    workletRef.current?.disconnect();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    contextRef.current?.close();
    contextRef.current = null;
    streamRef.current = null;
    workletRef.current = null;
    analyserRef.current = null;
    setIsCapturing(false);
  }, []);

  return { start, stop, isCapturing };
}
