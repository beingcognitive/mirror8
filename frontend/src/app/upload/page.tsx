"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import SelfieCapture from "@/components/SelfieCapture";
import GenerationProgress from "@/components/GenerationProgress";
import { generateFutures } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";

export default function UploadPage() {
  const router = useRouter();
  const { user, loading, getAccessToken } = useAuth();
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorRetryable, setErrorRetryable] = useState(false);

  // Profile step state
  const [capturedFile, setCapturedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [aboutMe, setAboutMe] = useState("");

  useEffect(() => {
    if (!loading && !user) {
      router.push("/");
    }
  }, [loading, user, router]);

  // Clean up preview URL on unmount
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleCapture = (file: File) => {
    setCapturedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setError(null);
  };

  const handleBack = () => {
    setCapturedFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setAboutMe("");
    setError(null);
  };

  const handleGenerate = async () => {
    if (!capturedFile) return;
    setGenerating(true);
    setError(null);

    try {
      const token = await getAccessToken();
      if (!token) {
        router.push("/");
        return;
      }
      const result = await generateFutures(capturedFile, token, aboutMe || undefined);
      sessionStorage.setItem("mirror8_session", JSON.stringify(result));
      router.push("/futures");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setErrorRetryable((err as any)?.retryable === true);
      setGenerating(false);
    }
  };

  if (loading || !user) return null;

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
        ) : capturedFile && previewUrl ? (
          /* ── Profile Step ── */
          <div className="w-full max-w-lg flex flex-col items-center gap-6">
            {/* Selfie thumbnail */}
            <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-mirror-600 shadow-lg shadow-mirror-500/20">
              <img
                src={previewUrl}
                alt="Your selfie"
                className="w-full h-full object-cover"
              />
            </div>

            <div className="text-center">
              <h1 className="text-2xl md:text-3xl font-bold mb-2">
                Before we imagine your futures...
              </h1>
              <p className="text-mirror-100 text-sm max-w-md">
                Tell us a bit about yourself so your future selves actually know you.
                The more you share, the more personal they become.
              </p>
            </div>

            {/* Free-form textarea */}
            <div className="w-full">
              <textarea
                value={aboutMe}
                onChange={(e) => setAboutMe(e.target.value)}
                placeholder={"e.g. I'm a 28-year-old software engineer in Seoul.\nMy goal for this year is to launch my own AI startup.\nI love building things but I'm scared of leaving my stable job."}
                className="w-full h-36 bg-mirror-800/60 border border-mirror-700 rounded-xl px-4 py-3 text-white placeholder:text-mirror-500 text-sm leading-relaxed resize-none focus:outline-none focus:border-mirror-500 focus:ring-1 focus:ring-mirror-500/30 transition"
              />
              <p className="text-mirror-300 text-xs mt-2 text-center">
                Age, goals, dreams, fears — anything you want your future self to know.
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-3 w-full">
              <button
                onClick={handleBack}
                className="px-5 py-3 rounded-full border border-mirror-600 text-mirror-300 hover:bg-mirror-800 transition text-sm"
              >
                Retake
              </button>
              <button
                onClick={handleGenerate}
                className="flex-1 py-3 rounded-full bg-gradient-to-r from-mirror-500 to-accent-dim text-white font-semibold hover:opacity-90 transition text-sm"
              >
                {aboutMe.trim() ? "Meet My Future Selves" : "Skip & Generate"}
              </button>
            </div>

            {error && (
              <div className="w-full px-4 py-4 bg-red-900/30 border border-red-800 rounded-xl text-center">
                <p className="text-red-300 text-sm">{error}</p>
                {errorRetryable && (
                  <button
                    onClick={handleGenerate}
                    className="mt-3 px-6 py-2 rounded-full bg-gradient-to-r from-mirror-500 to-accent-dim text-white font-semibold hover:opacity-90 transition text-sm"
                  >
                    Try Again
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
          /* ── Selfie Capture Step ── */
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
              <div className="mt-6 px-4 py-4 bg-red-900/30 border border-red-800 rounded-xl max-w-md text-center">
                <p className="text-red-300 text-sm">{error}</p>
                {errorRetryable && (
                  <button
                    onClick={handleGenerate}
                    className="mt-3 px-6 py-2 rounded-full bg-gradient-to-r from-mirror-500 to-accent-dim text-white font-semibold hover:opacity-90 transition text-sm"
                  >
                    Try Again
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
