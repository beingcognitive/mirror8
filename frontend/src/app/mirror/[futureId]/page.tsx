import { Suspense } from "react";
import MirrorPageClient from "./MirrorPageClient";

const ARCHETYPE_IDS = [
  "visionary", "healer", "artist", "explorer",
  "sage", "guardian", "maverick", "mystic",
];

export function generateStaticParams() {
  return ARCHETYPE_IDS.map((id) => ({ futureId: id }));
}

export default function MirrorPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-mirror-400">Loading...</div>
        </div>
      }
    >
      <MirrorPageClient />
    </Suspense>
  );
}
