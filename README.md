# Mirror8 — Meet Your Future Self

Real-time AI conversation with your future self. Upload a selfie, AI generates 8 future-self portraits, pick one, then have a live voice+video conversation where your future self can see you, hear you, and speak to you.

Powered by **Gemini** (text analysis, image generation, real-time voice) via Google ADK, with **Supabase** for auth and persistence.

## User Flow

```
Landing → Sign in with Google → Upload Selfie → AI generates 8 futures → Pick one → Live voice conversation
```

## Architecture

![Mirror8 System Architecture](docs/architecture.jpg)

**4 Gemini models** work in a coordinated pipeline:

| Phase | Model | Purpose |
|-------|-------|---------|
| **A — Analysis** | Gemini 3.1 Pro | Selfie analysis + 8 personalized backstories |
| **B — Portraits** | Gemini 3.1 Flash Image | Photorealistic portrait for each future self |
| **Live Conversation** | Gemini 2.5 Flash Native Audio (ADK) | Real-time bidirectional voice + camera vision |
| **Emotion Judge** | Gemini 3 Flash | Monitors emotional arc, triggers live portrait regeneration |

Each conversation creates a unique **ADK Agent** with a dynamic system prompt built from the archetype + selfie analysis + user context. The future self can see the user through the camera (1 FPS), hear them (16kHz PCM audio), and respond in character with a gender-matched voice.

During the conversation, the portrait **evolves in real time** — a separate Gemini model evaluates the emotional arc and regenerates the portrait at meaningful moments (breakthroughs, fears, dreams).

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 15 (static export), React 19, TypeScript, Tailwind CSS v4 |
| **Backend** | Python FastAPI, Google ADK, google-genai SDK |
| **Auth** | Supabase Auth (Google OAuth), JWKS/RS256 JWT verification |
| **Database** | Supabase PostgreSQL (sessions, futures tables with RLS) |
| **Storage** | Supabase Storage (portrait images, public bucket) |
| **AI — Analysis** | Gemini 3.1 Pro Preview (selfie → appearance + backstories) |
| **AI — Portraits** | Gemini 2.5 Flash Image (selfie + prompt → portrait) |
| **AI — Live Voice** | Gemini 2.5 Flash Native Audio via ADK (real-time conversation) |
| **Frontend Hosting** | Cloudflare Pages |
| **Backend Hosting** | Google Cloud Run |

## The 8 Futures

| Archetype | Title | Voice |
|-----------|-------|-------|
| The Visionary | Tech Pioneer & Founder | Kore |
| The Healer | Doctor & Humanitarian | Puck |
| The Artist | Creative Director & Storyteller | Charon |
| The Explorer | Adventurer & Travel Writer | Orus |
| The Sage | Professor & Philosopher | Aoede |
| The Guardian | Community Leader & Parent | Fenrir |
| The Maverick | Entrepreneur & Disruptor | Leda |
| The Mystic | Mindfulness Teacher & Writer | Kore |

## Quick Start

### Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # Add your GOOGLE_API_KEY + Supabase keys
uvicorn app.main:app --reload --port 8080
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:3000

### Environment Variables

**Frontend** (`.env.local` / Cloudflare Pages):
```
NEXT_PUBLIC_API_URL=http://localhost:8080
NEXT_PUBLIC_WS_URL=ws://localhost:8080
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

**Backend** (`.env` / Cloud Run):
```
GOOGLE_API_KEY=...
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SECRET_KEY=sb_secret_...
```

## Reproducible Testing

### Prerequisites

- **Google API Key** with access to Gemini models (get one at [aistudio.google.com](https://aistudio.google.com/apikey))
- **Supabase project** with Google OAuth configured ([supabase.com](https://supabase.com))
- **Chrome or Edge** (recommended for microphone + camera APIs)
- Python 3.12+, Node.js 18+

### Setup

1. Clone the repo and configure environment variables (see [Quick Start](#quick-start) above)
2. Start the backend: `cd backend && uvicorn app.main:app --reload --port 8080`
3. Start the frontend: `cd frontend && npm run dev`
4. Open http://localhost:3000

### Step-by-Step Test

1. **Sign in** — Click "Get Started with Google" and authenticate with your Google account.
2. **Upload a selfie** — Take a photo with your webcam or upload an image file. Optionally add personal context for more personalized future selves.
3. **Wait for generation** — Mirror8 analyzes the selfie and generates 8 future-self portraits with backstories. A progress UI shows generation status.
4. **Browse your 8 futures** — Review the generated futures and select one to begin.
5. **Start a conversation** — Allow microphone and camera permissions when prompted. The conversation starts automatically.
6. **Verify the live experience**
   - The future self responds with live voice.
   - The future self can reference visual details from the camera feed.
   - If you interrupt mid-sentence, the future self should stop and adapt to your interruption.
   - The portrait may update during meaningful moments in the conversation.
7. **Check persistence** — Return to the home page and open "My Futures" to confirm the session was saved and can be revisited.

### Expected Behavior

- Portrait generation takes ~60-90 seconds (8 portraits generated in parallel)
- Live conversation should feel near-real-time; exact latency depends on network and model load
- Portrait regeneration during conversation happens at emotionally meaningful moments (not on a timer)
- Sessions are saved to the signed-in account and can be revisited from My Futures

## Deployment

```bash
# Backend → Cloud Run
./infra/deploy.sh backend

# Frontend → Cloudflare Pages (auto-deploys on git push)
git push
```

Built for the Gemini Live Agent Challenge.
