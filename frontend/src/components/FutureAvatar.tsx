"use client";

import { useState, useEffect, useRef } from "react";
import { AvatarMood } from "@/lib/types";

interface FutureAvatarProps {
  portraitUrl: string | null;
  name: string;
  mood: AvatarMood;
  heroMode?: boolean;
  title?: string;
  waiting?: boolean;
}

export default function FutureAvatar({
  portraitUrl,
  name,
  mood,
  heroMode,
  title,
  waiting,
}: FutureAvatarProps) {
  const moodClass =
    mood === "speaking"
      ? "avatar-speaking"
      : mood === "listening"
        ? "avatar-listening"
        : "avatar-idle";

  // Crossfade state for live portrait updates
  const [displayUrl, setDisplayUrl] = useState(portraitUrl);
  const [prevUrl, setPrevUrl] = useState<string | null>(null);
  const [transitioning, setTransitioning] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout>(null);

  useEffect(() => {
    if (portraitUrl === displayUrl) return;

    // Preload new image before crossfading
    if (portraitUrl) {
      const img = document.createElement("img");
      img.onload = () => {
        setPrevUrl(displayUrl);
        setDisplayUrl(portraitUrl);
        setTransitioning(true);

        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
          setPrevUrl(null);
          setTransitioning(false);
        }, 700);
      };
      img.src = portraitUrl;
    } else {
      setDisplayUrl(portraitUrl);
    }
  }, [portraitUrl]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const sizeClass = heroMode
    ? "w-64 h-64 md:w-80 md:h-80 lg:w-96 lg:h-96"
    : "w-48 h-48 md:w-64 md:h-64";

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className={`${sizeClass} rounded-full overflow-hidden border-2 border-accent/40 ${moodClass} relative`}
      >
        {/* Previous image (fading out) */}
        {prevUrl && transitioning && (
          <img
            src={prevUrl}
            alt=""
            className="absolute inset-0 w-full h-full object-cover transition-opacity duration-700 opacity-0"
          />
        )}
        {/* Current image */}
        {displayUrl ? (
          <img
            src={displayUrl}
            alt={name}
            className={`w-full h-full object-cover ${transitioning ? "transition-opacity duration-700" : ""}`}
          />
        ) : (
          <div className="w-full h-full bg-mirror-700 flex items-center justify-center text-4xl">
            🪞
          </div>
        )}
      </div>
      <div className="text-center">
        <p className={`font-semibold text-accent ${heroMode ? "text-xl" : ""}`}>
          {name}
        </p>
        {heroMode && title && (
          <p className="text-sm text-mirror-300 mt-0.5">{title}</p>
        )}
        {heroMode && waiting && (
          <div className="flex items-center gap-1 mt-2">
            <span className="thinking-dot" style={{ animationDelay: "0s" }} />
            <span className="thinking-dot" style={{ animationDelay: "0.2s" }} />
            <span className="thinking-dot" style={{ animationDelay: "0.4s" }} />
          </div>
        )}
        {!heroMode && (
          <p className="text-xs text-mirror-400">
            {mood === "speaking"
              ? "Speaking..."
              : mood === "listening"
                ? "Listening..."
                : ""}
          </p>
        )}
      </div>
    </div>
  );
}
