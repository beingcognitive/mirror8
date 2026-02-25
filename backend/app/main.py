"""FastAPI application: REST endpoints + WebSocket for live conversation."""

import asyncio
import base64
import json
import logging
import uuid

from fastapi import FastAPI, File, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from google.adk.agents.live_request_queue import LiveRequestQueue
from google.adk.agents.run_config import RunConfig, StreamingMode
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types

from app.agent import create_mirror_agent
from app.config import APP_NAME, FRONTEND_URL
from app.generator import generate_all_futures
from app.personas import ARCHETYPE_MAP, ARCHETYPES
from app.session_store import (
    create_session,
    get_session,
    set_analysis,
    set_future,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Mirror8 API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL, "http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ADK session service (shared across all WebSocket connections)
session_service = InMemorySessionService()


# ──────────────────────────── REST Endpoints ────────────────────────────


@app.get("/health")
async def health():
    return {"status": "ok", "app": APP_NAME}


@app.post("/api/generate")
async def generate_futures(file: UploadFile = File(...)):
    """Accept selfie upload, run generation pipeline, return session data."""
    selfie_bytes = await file.read()
    selfie_mime = file.content_type or "image/jpeg"
    session_id = str(uuid.uuid4())

    logger.info(f"Starting generation for session {session_id} ({len(selfie_bytes)} bytes, {selfie_mime})")

    # Create session
    create_session(session_id, selfie_bytes, selfie_mime)

    try:
        analysis, futures = await generate_all_futures(selfie_bytes, selfie_mime)

        # Store results
        set_analysis(session_id, analysis)
        for future in futures:
            set_future(session_id, future)

        # Build response
        futures_meta = []
        for future in futures:
            futures_meta.append({
                "id": future.archetype_id,
                "name": future.name,
                "title": future.title,
                "backstory": future.backstory,
                "hasPortrait": future.portrait_bytes is not None,
            })

        return JSONResponse({
            "sessionId": session_id,
            "futures": futures_meta,
        })

    except Exception as e:
        logger.error(f"Generation failed: {e}", exc_info=True)
        return JSONResponse(
            status_code=500,
            content={"error": "Generation failed", "detail": str(e)},
        )


@app.get("/api/session/{session_id}")
async def get_session_data(session_id: str):
    """Get session metadata (without image binaries)."""
    session = get_session(session_id)
    if not session:
        return JSONResponse(status_code=404, content={"error": "Session not found"})

    futures_meta = []
    for fid, future in session.futures.items():
        futures_meta.append({
            "id": future.archetype_id,
            "name": future.name,
            "title": future.title,
            "backstory": future.backstory,
            "hasPortrait": future.portrait_bytes is not None,
        })

    return JSONResponse({
        "sessionId": session_id,
        "futures": futures_meta,
    })


@app.get("/api/session/{session_id}/portrait/{future_id}")
async def get_portrait(session_id: str, future_id: str):
    """Get portrait image binary for a specific future."""
    session = get_session(session_id)
    if not session:
        return JSONResponse(status_code=404, content={"error": "Session not found"})

    future = session.futures.get(future_id)
    if not future or not future.portrait_bytes:
        return JSONResponse(status_code=404, content={"error": "Portrait not found"})

    return Response(
        content=future.portrait_bytes,
        media_type=future.portrait_mime,
    )


# ──────────────────────────── WebSocket: Live Conversation ────────────────────────────


@app.websocket("/ws/mirror/{session_id}/{future_id}")
async def mirror_websocket(websocket: WebSocket, session_id: str, future_id: str):
    """Live conversation with a future-self persona via Gemini Live API."""
    await websocket.accept()
    logger.info(f"WebSocket connected: session={session_id}, future={future_id}")

    # Look up session and archetype
    session = get_session(session_id)
    if not session:
        await websocket.send_text(json.dumps({"type": "error", "message": "Session not found"}))
        await websocket.close()
        return

    archetype = ARCHETYPE_MAP.get(future_id)
    if not archetype:
        await websocket.send_text(json.dumps({"type": "error", "message": "Unknown archetype"}))
        await websocket.close()
        return

    # Get persona data from analysis
    persona_data = {}
    if session.analysis:
        persona_data = session.analysis.get("futures", {}).get(future_id, {})

    # Create per-session Agent
    agent = create_mirror_agent(
        archetype=archetype,
        persona_data=persona_data,
        analysis=session.analysis or {},
        session_id=session_id,
    )

    # Create per-session Runner
    runner = Runner(
        app_name=APP_NAME,
        agent=agent,
        session_service=session_service,
    )

    ws_session_id = str(uuid.uuid4())
    live_request_queue = LiveRequestQueue()

    # Create ADK session
    await session_service.create_session(
        app_name=APP_NAME,
        user_id=session_id,
        session_id=ws_session_id,
    )

    # Run config with archetype-specific voice
    run_config = RunConfig(
        streaming_mode=StreamingMode.BIDI,
        response_modalities=["AUDIO"],
        speech_config=types.SpeechConfig(
            voice_config=types.VoiceConfig(
                prebuilt_voice_config=types.PrebuiltVoiceConfig(
                    voice_name=archetype.voice_name,
                )
            )
        ),
        input_audio_transcription=types.AudioTranscriptionConfig(),
        output_audio_transcription=types.AudioTranscriptionConfig(),
        context_window_compression=types.ContextWindowCompressionConfig(
            trigger_tokens=100000,
            sliding_window=types.SlidingWindow(target_tokens=80000),
        ),
    )

    async def upstream_task():
        """Receive from browser WebSocket, forward to LiveRequestQueue."""
        try:
            while True:
                message = await websocket.receive()

                if "bytes" in message:
                    audio_blob = types.Blob(
                        mime_type="audio/pcm;rate=16000",
                        data=message["bytes"],
                    )
                    live_request_queue.send_realtime(audio_blob)

                elif "text" in message:
                    json_msg = json.loads(message["text"])
                    msg_type = json_msg.get("type")

                    if msg_type == "image":
                        image_data = base64.b64decode(json_msg["data"])
                        image_blob = types.Blob(
                            mime_type=json_msg.get("mimeType", "image/jpeg"),
                            data=image_data,
                        )
                        live_request_queue.send_realtime(image_blob)

                    elif msg_type == "text":
                        content = types.Content(
                            role="user",
                            parts=[types.Part(text=json_msg["text"])],
                        )
                        live_request_queue.send_content(content)

                    elif msg_type == "ping":
                        await websocket.send_text(json.dumps({"type": "pong"}))

        except WebSocketDisconnect:
            logger.info(f"Client disconnected (upstream): {session_id}")
        except Exception as e:
            logger.error(f"Upstream error: {e}", exc_info=True)

    async def downstream_task():
        """Receive events from Gemini via ADK, forward to browser."""
        try:
            # Send initial greeting to trigger the future self's opening
            greeting = types.Content(
                role="user",
                parts=[types.Part(text=(
                    "[System: Your younger self just appeared in front of you. "
                    "You're seeing them for the first time in years. "
                    "You can see them through the camera. "
                    "Take a moment — this is emotional. "
                    "Greet them as YOU would greet your past self. "
                    "Be genuine, be moved. Keep it brief — under 50 words.]"
                ))],
            )
            live_request_queue.send_content(greeting)

            async for event in runner.run_live(
                user_id=session_id,
                session_id=ws_session_id,
                live_request_queue=live_request_queue,
                run_config=run_config,
            ):
                # Audio from model (future self's voice)
                if event.content and event.content.parts:
                    for part in event.content.parts:
                        if part.inline_data and part.inline_data.data:
                            await websocket.send_bytes(part.inline_data.data)

                # Output transcription (what future self said)
                if hasattr(event, "output_transcription") and event.output_transcription:
                    text = event.output_transcription.text
                    if text and text.strip():
                        await websocket.send_text(
                            json.dumps({
                                "type": "transcript",
                                "role": "agent",
                                "text": text.strip(),
                            })
                        )

                # Input transcription (what user said)
                if hasattr(event, "input_transcription") and event.input_transcription:
                    text = event.input_transcription.text
                    if text and text.strip():
                        await websocket.send_text(
                            json.dumps({
                                "type": "transcript",
                                "role": "user",
                                "text": text.strip(),
                            })
                        )

                if event.interrupted:
                    await websocket.send_text(json.dumps({"type": "interrupted"}))

                if event.turn_complete:
                    await websocket.send_text(json.dumps({"type": "turn_complete"}))

        except WebSocketDisconnect:
            logger.info(f"Client disconnected (downstream): {session_id}")
        except Exception as e:
            logger.error(f"Downstream error: {e}", exc_info=True)

    try:
        await asyncio.gather(upstream_task(), downstream_task())
    except WebSocketDisconnect:
        logger.info(f"Client disconnected: {session_id}")
    except Exception as e:
        logger.error(f"WebSocket error: {e}", exc_info=True)
    finally:
        live_request_queue.close()
        logger.info(f"Session closed: {ws_session_id}")
