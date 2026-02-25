"use client";

import { AvatarMood } from "@/lib/types";

interface FutureAvatarProps {
  portraitUrl: string | null;
  name: string;
  mood: AvatarMood;
}

export default function FutureAvatar({
  portraitUrl,
  name,
  mood,
}: FutureAvatarProps) {
  const moodClass =
    mood === "speaking"
      ? "avatar-speaking"
      : mood === "listening"
        ? "avatar-listening"
        : "avatar-idle";

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className={`w-48 h-48 md:w-64 md:h-64 rounded-full overflow-hidden border-2 border-mirror-500 ${moodClass}`}
      >
        {portraitUrl ? (
          <img
            src={portraitUrl}
            alt={name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-mirror-700 flex items-center justify-center text-4xl">
            🪞
          </div>
        )}
      </div>
      <div className="text-center">
        <p className="font-semibold gradient-text">{name}</p>
        <p className="text-xs text-mirror-400">
          {mood === "speaking"
            ? "Speaking..."
            : mood === "listening"
              ? "Listening..."
              : ""}
        </p>
      </div>
    </div>
  );
}
