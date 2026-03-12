"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import SelfieCapture from "@/components/SelfieCapture";
import GenerationProgress from "@/components/GenerationProgress";
import { generateFuturesStream, GenerationProgress as ProgressEvent } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";

export default function UploadPage() {
  const router = useRouter();
  const { user, loading, getAccessToken } = useAuth();
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorRetryable, setErrorRetryable] = useState(false);
  const [progressEvent, setProgressEvent] = useState<ProgressEvent | null>(null);

  const [capturedFile, setCapturedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [aboutMe, setAboutMe] = useState("");

  useEffect(() => {
    if (!loading && !user) {
      router.push("/");
    }
  }, [loading, user, router]);

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

  const handleRetake = () => {
    setCapturedFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setError(null);
  };

  const handleGenerate = async () => {
    if (!capturedFile) return;
    setGenerating(true);
    setError(null);
    setErrorRetryable(false);
    setProgressEvent(null);

    try {
      const token = await getAccessToken();
      if (!token) {
        router.push("/");
        return;
      }
      const result = await generateFuturesStream(
        capturedFile,
        token,
        (event) => setProgressEvent(event),
        aboutMe || undefined,
      );
      sessionStorage.setItem("mirror8_session", JSON.stringify(result));
      router.push("/futures");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      const retryable = (err as any)?.retryable === true;
      setError(message);
      setErrorRetryable(retryable);
      if (!retryable) {
        setGenerating(false);
      }
    }
  };

  if (loading || !user) return null;

  if (generating) {
    return (
      <main className="min-h-screen flex flex-col">
        <nav className="flex items-center justify-between px-6 py-4">
          <Link href="/" className="text-xl font-bold gradient-text">
            Mirror8
          </Link>
        </nav>
        <div className="flex-1 flex flex-col items-center justify-start pt-6 md:justify-center px-6 md:py-12">
          <GenerationProgress
            event={progressEvent}
            error={error}
            retryable={errorRetryable}
            onRetry={handleGenerate}
          />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col">
      <nav className="flex items-center justify-between px-6 py-4">
        <Link href="/" className="text-xl font-bold gradient-text">
          Mirror8
        </Link>
      </nav>

      <div className="flex-1 flex flex-col items-center justify-start pt-6 md:justify-center px-6 md:py-12">
        <div className="w-full max-w-lg flex flex-col items-center gap-6">
          <div className="text-center">
            <h1 className="text-3xl md:text-4xl font-bold mb-2">
              {capturedFile ? "Before we imagine your futures..." : "Upload Your Selfie"}
            </h1>
            <p className="text-mirror-200 max-w-md">
              {capturedFile
                ? "Tell us a bit about yourself so your future selves actually know you. The more you share, the more personal they become."
                : "Take a clear, well-lit selfie. AI will use your features to create 8 personalized future-self portraits."}
            </p>
          </div>

          {/* Selfie: capture or preview */}
          {capturedFile && previewUrl ? (
            <div className="w-60 h-60 md:w-96 md:h-96 rounded-2xl overflow-hidden bg-mirror-800 border border-mirror-700">
              <img
                src={previewUrl}
                alt="Your selfie"
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <SelfieCapture onCapture={handleCapture} />
          )}

          {/* About me + actions — only after photo captured */}
          {capturedFile && (
            <>
              <div className="w-full">
                <textarea
                  value={aboutMe}
                  onChange={(e) => setAboutMe(e.target.value)}
                  placeholder={"e.g. I'm a 28-year-old software engineer in Seoul.\nMy goal for this year is to launch my own AI startup.\nI love building things but I'm scared of leaving my stable job."}
                  className="w-full h-36 bg-mirror-800/60 border border-mirror-700 rounded-xl px-4 py-3 text-mirror-100 placeholder:text-mirror-500 text-sm leading-relaxed resize-none focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition"
                />
                <p className="text-mirror-300 text-xs mt-2 text-center">
                  Optional — age, goals, dreams, fears — anything you want your future self to know.
                </p>
              </div>

              <div className="flex gap-3 w-full">
                <button
                  onClick={handleRetake}
                  className="px-5 py-3 rounded-full border border-mirror-600 text-mirror-300 hover:bg-mirror-800 transition text-sm"
                >
                  Retake
                </button>
                <button
                  onClick={handleGenerate}
                  className="flex-1 py-3.5 rounded-full bg-accent text-mirror-900 font-semibold hover:bg-accent-dim transition text-sm"
                >
                  {aboutMe.trim() ? "Meet My Future Selves" : "Skip & Generate"}
                </button>
              </div>
            </>
          )}

          {error && (
            <div className="w-full px-4 py-4 bg-red-900/30 border border-red-800 rounded-xl text-center">
              <p className="text-red-300 text-sm">{error}</p>
              {errorRetryable && (
                <button
                  onClick={handleGenerate}
                  className="mt-3 px-6 py-2 rounded-full bg-accent text-mirror-900 font-semibold hover:bg-accent-dim transition text-sm"
                >
                  Try Again
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
