"use client";

import { forwardRef } from "react";

interface CameraPreviewProps {
  isActive: boolean;
}

const CameraPreview = forwardRef<HTMLVideoElement, CameraPreviewProps>(
  ({ isActive }, ref) => {
    return (
      <div className="relative w-32 h-32 md:w-40 md:h-40 rounded-2xl overflow-hidden border border-mirror-700 bg-mirror-800">
        <video
          ref={ref}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover -scale-x-100"
        />
        {isActive && (
          <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-0.5 bg-red-600/80 rounded-full">
            <div className="w-1.5 h-1.5 bg-white rounded-full live-badge" />
            <span className="text-[10px] font-bold text-white">LIVE</span>
          </div>
        )}
      </div>
    );
  },
);

CameraPreview.displayName = "CameraPreview";
export default CameraPreview;
