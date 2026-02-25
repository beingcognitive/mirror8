"use client";

import { useRef, useCallback, useState, useEffect } from "react";

interface UseCameraCaptureOptions {
  onFrame: (base64: string) => void;
  fps?: number;
  resolution?: number;
}

export function useCameraCapture({
  onFrame,
  fps = 1,
  resolution = 768,
}: UseCameraCaptureOptions) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const onFrameRef = useRef(onFrame);

  useEffect(() => {
    onFrameRef.current = onFrame;
  }, [onFrame]);

  const start = useCallback(
    async (videoElement: HTMLVideoElement) => {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: resolution, height: resolution },
      });

      videoElement.srcObject = stream;
      videoRef.current = videoElement;
      streamRef.current = stream;

      // Create offscreen canvas for JPEG encoding
      const canvas = document.createElement("canvas");
      canvas.width = resolution;
      canvas.height = resolution;
      canvasRef.current = canvas;

      setIsCapturing(true);

      // Capture frames at specified FPS
      intervalRef.current = setInterval(() => {
        if (!videoRef.current || !canvasRef.current) return;
        const ctx = canvasRef.current.getContext("2d")!;
        const v = videoRef.current;

        // Center crop to square
        const size = Math.min(v.videoWidth, v.videoHeight);
        const sx = (v.videoWidth - size) / 2;
        const sy = (v.videoHeight - size) / 2;
        ctx.drawImage(v, sx, sy, size, size, 0, 0, resolution, resolution);

        const dataUrl = canvasRef.current.toDataURL("image/jpeg", 0.7);
        // Strip the data:image/jpeg;base64, prefix
        const base64 = dataUrl.split(",")[1];
        onFrameRef.current(base64);
      }, 1000 / fps);
    },
    [fps, resolution],
  );

  const stop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setIsCapturing(false);
  }, []);

  return { start, stop, isCapturing };
}
