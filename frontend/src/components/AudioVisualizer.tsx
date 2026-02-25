"use client";

interface AudioVisualizerProps {
  level: number; // 0-1
  isActive: boolean;
}

export default function AudioVisualizer({
  level,
  isActive,
}: AudioVisualizerProps) {
  const bars = 5;

  return (
    <div className="flex items-end gap-0.5 h-6">
      {Array.from({ length: bars }).map((_, i) => {
        const threshold = (i + 1) / bars;
        const active = isActive && level >= threshold * 0.5;
        return (
          <div
            key={i}
            className={`w-1 rounded-full transition-all duration-100 ${
              active ? "bg-accent" : "bg-mirror-700"
            }`}
            style={{
              height: active
                ? `${Math.max(8, Math.min(24, level * 24 * ((i + 1) / bars)))}px`
                : "4px",
            }}
          />
        );
      })}
    </div>
  );
}
