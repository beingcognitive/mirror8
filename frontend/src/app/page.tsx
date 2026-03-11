"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";

export default function LandingPage() {
  const { user, loading, signIn, signOut } = useAuth();
  const router = useRouter();

  const handleCTA = () => {
    if (user) {
      router.push("/upload");
    } else {
      signIn();
    }
  };

  return (
    <main className="min-h-screen flex flex-col">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4">
        <div className="text-xl font-bold gradient-text">Mirror8</div>
        <div className="flex items-center gap-3">
          {!loading && user ? (
            <>
              {user.user_metadata?.avatar_url && (
                <img
                  src={user.user_metadata.avatar_url}
                  alt=""
                  className="w-8 h-8 rounded-full"
                  referrerPolicy="no-referrer"
                />
              )}
              <span className="text-sm text-mirror-200 hidden sm:inline">
                {user.user_metadata?.full_name || user.email}
              </span>
              <button
                onClick={signOut}
                className="px-4 py-2 rounded-full border border-mirror-600 text-mirror-200 hover:bg-mirror-800 transition text-sm"
              >
                Sign Out
              </button>
            </>
          ) : !loading ? (
            <button
              onClick={signIn}
              className="px-4 py-2 rounded-full bg-mirror-600 hover:bg-mirror-500 transition text-sm font-medium"
            >
              Sign In
            </button>
          ) : null}
        </div>
      </nav>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center px-6 text-center max-w-3xl mx-auto">
        <div className="mb-6 w-20 h-20 rounded-2xl overflow-hidden">
          <img src="/hero.jpg" alt="Mirror8" className="w-full h-full object-cover" />
        </div>
        <h1 className="text-5xl md:text-6xl font-bold mb-6 leading-tight">
          Meet Your{" "}
          <span className="gradient-text">Future Self</span>
        </h1>
        <p className="text-lg md:text-xl text-mirror-200 mb-8 max-w-xl">
          Upload a selfie. AI imagines 8 possible futures for you. Pick one —
          then have a real-time voice conversation with who you could become.
        </p>
        <button
          onClick={handleCTA}
          className="px-8 py-4 rounded-full bg-accent text-mirror-900 font-semibold text-lg hover:bg-accent-dim transition"
        >
          {user ? "Upload Your Selfie" : "Get Started with Google"}
        </button>
        <p className="mt-4 text-sm text-mirror-400">
          {user
            ? "Your sessions are saved to your account."
            : "Sign in with Google to save your sessions."}
        </p>
      </section>

      {/* Features */}
      <section className="px-6 py-16 max-w-5xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-mirror-800/50 rounded-2xl p-6 border border-mirror-700">
            <div className="text-3xl mb-4">📸</div>
            <h3 className="text-lg font-bold mb-2">1. Upload a Selfie</h3>
            <p className="text-mirror-300 text-sm">
              Take a photo or upload one. AI analyzes your features to create
              personalized future portraits.
            </p>
          </div>
          <div className="bg-mirror-800/50 rounded-2xl p-6 border border-mirror-700">
            <div className="text-3xl mb-4">✨</div>
            <h3 className="text-lg font-bold mb-2">2. Choose a Future</h3>
            <p className="text-mirror-300 text-sm">
              8 possible futures — The Visionary, The Healer, The Artist, and
              more. Each with a unique portrait and story.
            </p>
          </div>
          <div className="bg-mirror-800/50 rounded-2xl p-6 border border-mirror-700">
            <div className="text-3xl mb-4">🗣️</div>
            <h3 className="text-lg font-bold mb-2">3. Have a Conversation</h3>
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
          Built with Gemini Live API.
        </p>
      </footer>
    </main>
  );
}
