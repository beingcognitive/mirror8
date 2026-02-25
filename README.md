# Mirror8 — Meet Your Future Self

Real-time AI conversation with your future self. Upload a selfie, AI generates 8 future-self portraits, pick one, then have a live voice+video conversation where your future self can see you, hear you, and speak to you.

Powered by **Gemini 2.5 Flash** (image generation) and **Gemini Live API** (real-time voice conversation) via Google ADK.

## User Flow

```
Landing → Upload Selfie → AI generates 8 futures → Pick one → Live voice conversation
```

## Quick Start

### Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # Add your GOOGLE_API_KEY
uvicorn app.main:app --reload --port 8080
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:3000

## Architecture

```
Browser (Next.js)
├── Selfie → POST /api/generate → FastAPI → Gemini 2.5 Flash
├── Mic → 16kHz PCM → WebSocket → FastAPI → Gemini Live API
├── Camera → 1FPS JPEG → WebSocket → FastAPI → Gemini Live API
└── Future-self voice ← WebSocket ← FastAPI ← Gemini Live API
```

## Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS
- **Backend**: Python FastAPI, Google ADK, google-genai SDK
- **AI Generation**: Gemini 2.5 Flash (text + image generation)
- **AI Live**: Gemini 2.5 Flash Native Audio (real-time conversation)
- **Deployment**: Google Cloud Run

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

Inspired by Ted Chiang's "Anxiety Is the Dizziness of Freedom."

Built for the Gemini Live Agent Challenge.
