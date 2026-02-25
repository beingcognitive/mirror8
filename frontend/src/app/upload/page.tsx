"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import SelfieCapture from "@/components/SelfieCapture";
import GenerationProgress from "@/components/GenerationProgress";
import { generateFutures } from "@/lib/api";

export default function UploadPage() {
  const router = useRouter();
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCapture = async (file: File) => {
    setGenerating(true);
    setError(null);

    try {
      const result = await generateFutures(file);
      // Store in sessionStorage for the futures page
      sessionStorage.setItem("mirror8_session", JSON.stringify(result));
      router.push("/futures");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setGenerating(false);
    }
  };

  return (
    <main className="min-h-screen flex flex-col">
      <nav className="flex items-center justify-between px-6 py-4">
        <Link href="/" className="text-xl font-bold gradient-text">
          Mirror8
        </Link>
      </nav>

      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        {generating ? (
          <GenerationProgress />
        ) : (
          <>
            <h1 className="text-3xl md:text-4xl font-bold mb-2 text-center">
              Upload Your Selfie
            </h1>
            <p className="text-mirror-300 mb-8 text-center max-w-md">
              Take a clear, well-lit selfie. AI will use your features to create
              8 personalized future-self portraits.
            </p>
            <SelfieCapture onCapture={handleCapture} />
            {error && (
              <div className="mt-6 px-4 py-3 bg-red-900/30 border border-red-800 rounded-xl text-red-300 text-sm max-w-md text-center">
                {error}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
