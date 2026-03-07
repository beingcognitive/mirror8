"use client";

import { useRef, useState, useCallback, useEffect } from "react";

interface SelfieCaptureProps {
  onCapture: (file: File) => void;
}

export default function SelfieCapture({ onCapture }: SelfieCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [capturedFile, setCapturedFile] = useState<File | null>(null);
  const [cameraActive, setCameraActive] = useState(false);

  // Attach stream to video element once both exist
  useEffect(() => {
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(() => {});
    }
  }, [stream, cameraActive]);

  const startCamera = useCallback(async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 1024, height: 1024 },
      });
      setCameraActive(true);
      setStream(mediaStream);
    } catch {
      alert("Camera access denied. Please upload a photo instead.");
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      setStream(null);
    }
    setCameraActive(false);
  }, [stream]);

  const takePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const size = Math.min(video.videoWidth, video.videoHeight);
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    // Center crop
    const sx = (video.videoWidth - size) / 2;
    const sy = (video.videoHeight - size) / 2;
    ctx.drawImage(video, sx, sy, size, size, 0, 0, size, size);

    canvas.toBlob(
      (blob) => {
        if (blob) {
          const file = new File([blob], "selfie.jpg", { type: "image/jpeg" });
          setCapturedFile(file);
          setPreview(canvas.toDataURL("image/jpeg"));
          stopCamera();
        }
      },
      "image/jpeg",
      0.9,
    );
  }, [stopCamera]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCapturedFile(file);
    setPreview(URL.createObjectURL(file));
    stopCamera();
  };

  const retake = () => {
    setPreview(null);
    setCapturedFile(null);
  };

  const confirm = () => {
    if (capturedFile) {
      onCapture(capturedFile);
    }
  };

  return (
    <div className="flex flex-col items-center gap-6">
      <canvas ref={canvasRef} className="hidden" />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileUpload}
      />

      {/* Preview or Camera */}
      <div className="w-60 h-60 md:w-96 md:h-96 rounded-2xl overflow-hidden bg-mirror-800 border border-mirror-700 relative">
        {preview ? (
          <img
            src={preview}
            alt="Selfie preview"
            className="w-full h-full object-cover"
          />
        ) : cameraActive ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover -scale-x-100"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-mirror-400 gap-4">
            <div className="text-5xl">📸</div>
            <p className="text-sm">Take a selfie or upload a photo</p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        {preview ? (
          <>
            <button
              onClick={retake}
              className="px-6 py-3 rounded-full border border-mirror-600 text-mirror-200 hover:bg-mirror-800 transition"
            >
              Retake
            </button>
            <button
              onClick={confirm}
              className="px-6 py-3 rounded-full bg-gradient-to-r from-mirror-500 to-accent-dim text-white font-semibold hover:opacity-90 transition"
            >
              Use This Photo
            </button>
          </>
        ) : cameraActive ? (
          <button
            onClick={takePhoto}
            className="w-16 h-16 rounded-full bg-white border-4 border-mirror-400 hover:scale-105 transition"
            aria-label="Take photo"
          />
        ) : (
          <>
            <button
              onClick={startCamera}
              className="px-6 py-3 rounded-full bg-mirror-600 hover:bg-mirror-500 transition font-medium"
            >
              Open Camera
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-6 py-3 rounded-full border border-mirror-600 text-mirror-200 hover:bg-mirror-800 transition"
            >
              Upload Photo
            </button>
          </>
        )}
      </div>
    </div>
  );
}
