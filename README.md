# Mirror8 — Meet Your Future Self

Real-time AI conversation with your future self. Upload a selfie, AI generates 8 future-self portraits, pick one, then have a live voice+video conversation where your future self can see you, hear you, and speak to you.

Powered by **Gemini** (text analysis, image generation, real-time voice) via Google ADK, with **Supabase** for auth and persistence.

## User Flow

```
Landing → Sign in with Google → Upload Selfie → AI generates 8 futures → Pick one → Live voice conversation
```

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Browser (Next.js static export on Cloudflare Pages)            │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐ │
│  │ Landing Page  │  │ Upload Page  │  │ Mirror Room            │ │
│  │ Google OAuth  │→ │ SelfieCapture│→ │ Live voice + camera    │ │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬─────────────┘ │
│         │                 │                      │               │
│  ┌──────▼─────────────────▼──────────────────────▼─────────────┐ │
│  │ Supabase JS Client (Auth + session tokens)                  │ │
│  └─────────────────────────┬───────────────────────────────────┘ │
└─────────────────────────────┼───────────────────────────────────┘
                              │ Bearer JWT
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  FastAPI Backend (Google Cloud Run)                              │
│                                                                 │
│  ┌──────────┐  ┌──────────────┐  ┌─────────────────────────┐   │
│  │ auth.py  │  │ generator.py │  │ main.py                 │   │
│  │ JWKS/RS256│  │ Phase A+B    │  │ REST + WebSocket        │   │
│  └──────────┘  └──────┬───────┘  └──────────┬──────────────┘   │
│                       │                      │                  │
│          ┌────────────▼──────────────────────▼───────────────┐  │
│          │              Google Gemini APIs                    │  │
│          │  ┌─────────────────┐  ┌────────────────────────┐  │  │
│          │  │ gemini-3.1-pro  │  │ gemini-2.5-flash-image │  │  │
│          │  │ Text Analysis   │  │ Portrait Generation    │  │  │
│          │  └─────────────────┘  └────────────────────────┘  │  │
│          │  ┌──────────────────────────────────────────────┐  │  │
│          │  │ gemini-2.5-flash-native-audio (Live API)     │  │  │
│          │  │ Real-time voice conversation via ADK          │  │  │
│          │  └──────────────────────────────────────────────┘  │  │
│          └───────────────────────────────────────────────────┘  │
│                                                                 │
│          ┌───────────────────────────────────────────────────┐  │
│          │              Supabase (via service key)            │  │
│          │  ┌──────────┐  ┌──────────┐  ┌────────────────┐  │  │
│          │  │ sessions │  │ futures  │  │ conversations  │  │  │
│          │  │ (DB)     │  │ (DB)     │  │ (DB)           │  │  │
│          │  └──────────┘  └──────────┘  └────────────────┘  │  │
│          │  ┌────────────────────────────────────────────┐   │  │
│          │  │ portraits (Storage)                         │   │  │
│          │  └────────────────────────────────────────────┘   │  │
│          └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Generation Pipeline

```
Selfie upload
  │
  ├─ Phase A: Gemini 3.1 Pro → JSON analysis (appearance + 8 personalized backstories)
  │
  └─ Phase B: Gemini 2.5 Flash Image (×8, max 4 concurrent)
       │       selfie + archetype prompt → portrait image
       │
       └─ Store: session → Supabase DB, portraits → Supabase Storage
```

### Live Conversation

```
Browser mic (16kHz PCM) ──→ WebSocket ──→ FastAPI ──→ Gemini Live API (ADK)
Browser camera (1 FPS)  ──→ WebSocket ──→ FastAPI ──→ Gemini Live API (ADK)
Future-self voice       ←── WebSocket ←── FastAPI ←── Gemini Live API (ADK)
Transcriptions          ←── WebSocket ←── FastAPI ←── Gemini Live API (ADK)
```

Each conversation gets a unique ADK Agent with a persona-specific system prompt built from the archetype + Phase A analysis. The future self can see the user through the camera and respond in character.

### Session History

Users can browse past sessions with page-flip navigation arrows on the futures grid. The most recent session shows no date label; older sessions display their creation date. Sessions are cached client-side after first load for instant navigation.

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

## Deployment

```bash
# Backend → Cloud Run
./infra/deploy.sh backend

# Frontend → Cloudflare Pages (auto-deploys on git push)
git push
```

## Known Issues & Fixes

### `nonlocal` required for nested async closures (fixed in revision 00032)

The `audio_suppressed` flag in `mirror_websocket` is read and written inside the nested `downstream_task` function. Python treats any variable assigned with `=` inside a nested function as local to that function — even if it's defined in an enclosing scope. This means reading it *before* the first local assignment raises `UnboundLocalError`. The fix is `nonlocal audio_suppressed` at the top of the nested function.

Other closure variables like `pending_agent_text` didn't hit this because they use `.append()` / `.clear()` (mutation, not reassignment).

---

Built for the Gemini Live Agent Challenge.
