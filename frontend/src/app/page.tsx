"use client";

import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="min-h-screen flex flex-col">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4">
        <div className="text-xl font-bold gradient-text">Mirror8</div>
        <Link
          href="/upload"
          className="px-4 py-2 rounded-full bg-mirror-600 hover:bg-mirror-500 transition text-sm font-medium"
        >
          Get Started
        </Link>
      </nav>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center px-6 text-center max-w-3xl mx-auto">
        <div className="mb-6 text-6xl">🪞</div>
        <h1 className="text-5xl md:text-6xl font-bold mb-6 leading-tight">
          Meet Your{" "}
          <span className="gradient-text">Future Self</span>
        </h1>
        <p className="text-lg md:text-xl text-mirror-200 mb-8 max-w-xl">
          Upload a selfie. AI imagines 8 possible futures for you. Pick one —
          then have a real-time voice conversation with who you could become.
        </p>
        <Link
          href="/upload"
          className="px-8 py-4 rounded-full bg-gradient-to-r from-mirror-500 to-accent-dim text-white font-semibold text-lg hover:opacity-90 transition"
        >
          Upload Your Selfie
        </Link>
        <p className="mt-4 text-sm text-mirror-400">
          No sign-up required. Your photos are not stored permanently.
        </p>
      </section>

      {/* Features */}
      <section className="px-6 py-16 max-w-5xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-mirror-800/50 rounded-2xl p-6 border border-mirror-700">
            <div className="text-3xl mb-4">📸</div>
            <h3 className="text-lg font-semibold mb-2">1. Upload a Selfie</h3>
            <p className="text-mirror-300 text-sm">
              Take a photo or upload one. AI analyzes your features to create
              personalized future portraits.
            </p>
          </div>
          <div className="bg-mirror-800/50 rounded-2xl p-6 border border-mirror-700">
            <div className="text-3xl mb-4">✨</div>
            <h3 className="text-lg font-semibold mb-2">2. Choose a Future</h3>
            <p className="text-mirror-300 text-sm">
              8 possible futures — The Visionary, The Healer, The Artist, and
              more. Each with a unique portrait and story.
            </p>
          </div>
          <div className="bg-mirror-800/50 rounded-2xl p-6 border border-mirror-700">
            <div className="text-3xl mb-4">🗣️</div>
            <h3 className="text-lg font-semibold mb-2">3. Have a Conversation</h3>
            <p className="text-mirror-300 text-sm">
              Talk in real-time. Your future self can see you, hear you, and
              speak back. Unscripted. Genuine.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 py-8 text-center text-mirror-500 text-sm">
        <p>
          Inspired by Ted Chiang&apos;s &quot;Anxiety Is the Dizziness of Freedom.&quot;
        </p>
        <p className="mt-1">
          Built with Gemini Live API for the Gemini Live Agent Challenge.
        </p>
      </footer>
    </main>
  );
}
