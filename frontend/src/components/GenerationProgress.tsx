"use client";

import { useState, useEffect } from "react";

const STEPS = [
  "Analyzing your features...",
  "Imagining your possible futures...",
  "Creating personalized backstories...",
  "Generating The Visionary portrait...",
  "Generating The Healer portrait...",
  "Generating The Artist portrait...",
  "Generating The Explorer portrait...",
  "Generating The Sage portrait...",
  "Generating The Guardian portrait...",
  "Generating The Maverick portrait...",
  "Generating The Mystic portrait...",
  "Finalizing your 8 futures...",
];

export default function GenerationProgress() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setStep((prev) => (prev < STEPS.length - 1 ? prev + 1 : prev));
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const progress = ((step + 1) / STEPS.length) * 100;

  return (
    <div className="flex flex-col items-center gap-8 text-center max-w-md mx-auto">
      {/* Animated orb */}
      <div className="relative w-32 h-32">
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-mirror-500 to-accent opacity-30 animate-ping" />
        <div className="absolute inset-4 rounded-full bg-gradient-to-br from-mirror-500 to-accent opacity-60 animate-pulse" />
        <div className="absolute inset-8 rounded-full bg-gradient-to-br from-mirror-400 to-accent" />
      </div>

      <h2 className="text-2xl font-bold gradient-text">Creating Your Futures</h2>

      <p className="text-mirror-200 text-lg">{STEPS[step]}</p>

      {/* Progress bar */}
      <div className="w-full h-2 bg-mirror-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-mirror-500 to-accent transition-all duration-1000 ease-out rounded-full"
          style={{ width: `${progress}%` }}
        />
      </div>

      <p className="text-mirror-500 text-sm">
        This takes about 60 seconds. Your 8 future selves are being imagined...
      </p>
    </div>
  );
}
