"""FastAPI application: REST endpoints + WebSocket for live conversation."""

import asyncio
import base64
import json
import logging
import time
import uuid
from datetime import datetime, timezone

from fastapi import Depends, FastAPI, File, Form, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse, StreamingResponse
from google.adk.agents.live_request_queue import LiveRequestQueue
from google.adk.agents.run_config import RunConfig, StreamingMode
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types

from app.agent import create_mirror_agent
from app.auth import get_current_user, verify_ws_token
from app.config import APP_NAME, FRONTEND_URL
from app.generator import generate_all_futures
from app.personas import ARCHETYPE_MAP, ARCHETYPES
from app.live_portrait import generate_live_portrait, should_update_portrait
from app.session_store import (
    create_session,
    get_conversations,
    get_conversations_for_future,
    get_selfie_bytes,
    get_session,
    get_user_sessions,
    save_conversation,
    set_future,
    update_session_analysis,
    upload_selfie,
)
from app.tools.session_summary import get_session_insights

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Mirror8 API", version="0.2.0")

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
async def generate_futures_endpoint(
    file: UploadFile = File(...),
    about_me: str = Form(""),
    user_id: str = Depends(get_current_user),
):
    """Accept selfie upload, run generation pipeline, return session data."""
    selfie_bytes = await file.read()
    selfie_mime = file.content_type or "image/jpeg"

    logger.info(f"Starting generation for user {user_id} ({len(selfie_bytes)} bytes, {selfie_mime})")
    if about_me:
        logger.info(f"User profile: {about_me[:100]}...")

    try:
        analysis, futures = await generate_all_futures(selfie_bytes, selfie_mime, about_me)

        # Store about_me in analysis for later use (conversations)
        analysis["about_me"] = about_me

        # Create session in Supabase with analysis
        session_id = create_session(user_id, analysis)

        # Upload selfie for later use in live portrait generation
        try:
            selfie_path = upload_selfie(session_id, selfie_bytes, selfie_mime)
            analysis["selfie_path"] = selfie_path
            analysis["selfie_mime"] = selfie_mime
            update_session_analysis(session_id, analysis)
        except Exception as e:
            logger.warning(f"Failed to upload selfie for live portraits: {e}")

        # Store each future (DB row + portrait upload)
        futures_meta = []
        for future in futures:
            portrait_url = set_future(session_id, future)
            futures_meta.append({
                "id": future.archetype_id,
                "name": future.name,
                "title": future.title,
                "backstory": future.backstory,
                "portraitUrl": portrait_url,
                "hasPortrait": future.portrait_bytes is not None,
            })

        return JSONResponse({
            "sessionId": session_id,
            "futures": futures_meta,
        })

    except Exception as e:
        logger.error(f"Generation failed: {e}", exc_info=True)
        err_str = str(e)
        is_capacity = "503" in err_str or "UNAVAILABLE" in err_str or "high demand" in err_str or isinstance(e, TimeoutError)
        if is_capacity:
            return JSONResponse(
                status_code=503,
                content={
                    "error": "Generation failed",
                    "detail": "Our AI models are experiencing high demand right now. This is usually temporary.",
                    "retryable": True,
                },
            )
        return JSONResponse(
            status_code=500,
            content={"error": "Generation failed", "detail": str(e)},
        )


@app.post("/api/generate-stream")
async def generate_futures_stream(
    file: UploadFile = File(...),
    about_me: str = Form(""),
    user_id: str = Depends(get_current_user),
):
    """SSE streaming version of /api/generate — sends progress events."""
    selfie_bytes = await file.read()
    selfie_mime = file.content_type or "image/jpeg"

    logger.info(f"Starting streaming generation for user {user_id} ({len(selfie_bytes)} bytes)")

    async def event_stream():
        progress_queue: asyncio.Queue[dict] = asyncio.Queue()

        def on_progress(event_type: str, data: dict):
            progress_queue.put_nowait({"type": event_type, **data})

        try:
            # Run generation with progress callbacks
            gen_task = asyncio.create_task(
                generate_all_futures(selfie_bytes, selfie_mime, about_me, on_progress=on_progress)
            )

            # Drain progress events while generation runs
            while not gen_task.done():
                try:
                    event = await asyncio.wait_for(progress_queue.get(), timeout=0.5)
                    yield f"data: {json.dumps(event)}\n\n"
                except asyncio.TimeoutError:
                    continue

            # Get the result (will re-raise if generation failed)
            analysis, futures = gen_task.result()

            # Drain any remaining progress events
            while not progress_queue.empty():
                event = progress_queue.get_nowait()
                yield f"data: {json.dumps(event)}\n\n"

            yield f"data: {json.dumps({'type': 'storing'})}\n\n"

            # Store about_me in analysis
            analysis["about_me"] = about_me

            # Create session
            session_id = create_session(user_id, analysis)

            # Upload selfie
            try:
                selfie_path = upload_selfie(session_id, selfie_bytes, selfie_mime)
                analysis["selfie_path"] = selfie_path
                analysis["selfie_mime"] = selfie_mime
                update_session_analysis(session_id, analysis)
            except Exception as e:
                logger.warning(f"Failed to upload selfie: {e}")

            # Store each future
            futures_meta = []
            for future in futures:
                portrait_url = set_future(session_id, future)
                futures_meta.append({
                    "id": future.archetype_id,
                    "name": future.name,
                    "title": future.title,
                    "backstory": future.backstory,
                    "portraitUrl": portrait_url,
                    "hasPortrait": future.portrait_bytes is not None,
                })

            yield f"data: {json.dumps({'type': 'complete', 'sessionId': session_id, 'futures': futures_meta})}\n\n"

        except Exception as e:
            logger.error(f"Streaming generation failed: {e}", exc_info=True)
            err_str = str(e)
            is_capacity = "503" in err_str or "UNAVAILABLE" in err_str or "high demand" in err_str or isinstance(e, TimeoutError)
            yield f"data: {json.dumps({'type': 'error', 'message': 'Our AI models are experiencing high demand right now. This is usually temporary.' if is_capacity else str(e), 'retryable': is_capacity})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@app.get("/api/session/{session_id}")
async def get_session_data(
    session_id: str,
    user_id: str = Depends(get_current_user),
):
    """Get session metadata."""
    session = get_session(session_id)
    if not session:
        return JSONResponse(status_code=404, content={"error": "Session not found"})

    # Verify ownership
    if session["user_id"] != user_id:
        return JSONResponse(status_code=403, content={"error": "Forbidden"})

    return JSONResponse({
        "sessionId": session["session_id"],
        "futures": session["futures"],
    })


@app.get("/api/session/{session_id}/portrait/{future_id}")
async def get_portrait(
    session_id: str,
    future_id: str,
    user_id: str = Depends(get_current_user),
):
    """Redirect to Supabase Storage public URL for the portrait."""
    session = get_session(session_id)
    if not session:
        return JSONResponse(status_code=404, content={"error": "Session not found"})

    if session["user_id"] != user_id:
        return JSONResponse(status_code=403, content={"error": "Forbidden"})

    for future in session["futures"]:
        if future["id"] == future_id and future["portraitUrl"]:
            return RedirectResponse(url=future["portraitUrl"])

    return JSONResponse(status_code=404, content={"error": "Portrait not found"})


@app.get("/api/my-sessions")
async def list_my_sessions(user_id: str = Depends(get_current_user)):
    """List the current user's past sessions."""
    sessions = get_user_sessions(user_id)
    return JSONResponse({"sessions": sessions})


@app.get("/api/session/{session_id}/conversations")
async def list_conversations(
    session_id: str,
    user_id: str = Depends(get_current_user),
):
    """List past conversations for a session."""
    session = get_session(session_id)
    if not session:
        return JSONResponse(status_code=404, content={"error": "Session not found"})
    if session["user_id"] != user_id:
        return JSONResponse(status_code=403, content={"error": "Forbidden"})

    conversations = get_conversations(session_id)
    return JSONResponse({"conversations": conversations})


@app.get("/api/session/{session_id}/conversations/{future_id}")
async def list_future_conversations(
    session_id: str,
    future_id: str,
    user_id: str = Depends(get_current_user),
):
    """List past conversations for a specific future within a session."""
    session = get_session(session_id)
    if not session:
        return JSONResponse(status_code=404, content={"error": "Session not found"})
    if session["user_id"] != user_id:
        return JSONResponse(status_code=403, content={"error": "Forbidden"})

    conversations = get_conversations_for_future(session_id, future_id)
    return JSONResponse({"conversations": conversations})


# ──────────────────────────── WebSocket: Live Conversation ────────────────────────────


@app.websocket("/ws/mirror/{session_id}/{future_id}")
async def mirror_websocket(websocket: WebSocket, session_id: str, future_id: str):
    """Live conversation with a future-self persona via Gemini Live API."""
    # Verify auth from query param before accepting
    try:
        user_id = verify_ws_token(websocket)
    except Exception:
        await websocket.close(code=4001, reason="Unauthorized")
        return

    await websocket.accept()
    logger.info(f"WebSocket connected: session={session_id}, future={future_id}, user={user_id}")

    # Look up session and verify ownership
    session = get_session(session_id)
    if not session:
        await websocket.send_text(json.dumps({"type": "error", "message": "Session not found"}))
        await websocket.close()
        return

    if session["user_id"] != user_id:
        await websocket.send_text(json.dumps({"type": "error", "message": "Forbidden"}))
        await websocket.close()
        return

    archetype = ARCHETYPE_MAP.get(future_id)
    if not archetype:
        await websocket.send_text(json.dumps({"type": "error", "message": "Unknown archetype"}))
        await websocket.close()
        return

    # Get persona data from analysis
    persona_data = {}
    analysis = session.get("analysis") or {}
    if analysis:
        persona_data = analysis.get("futures", {}).get(future_id, {})

    about_me = analysis.get("about_me", "")
    appearance = analysis.get("appearance", {})

    # Load selfie for live portrait generation
    selfie_bytes = None
    selfie_mime = analysis.get("selfie_mime", "image/jpeg")
    selfie_path = analysis.get("selfie_path")
    if selfie_path:
        try:
            selfie_bytes = get_selfie_bytes(selfie_path)
            logger.info(f"Loaded selfie for live portraits ({len(selfie_bytes)} bytes)")
        except Exception as e:
            logger.warning(f"Could not load selfie for live portraits: {e}")

    # Live portrait generation state
    portrait_gen_state = {"in_flight": False, "index": 0, "turn_count": 0}

    # Fetch past conversations for this future (for memory continuity)
    past_conversations = get_conversations_for_future(session_id, future_id)

    # Create per-session Agent
    agent = create_mirror_agent(
        archetype=archetype,
        persona_data=persona_data,
        analysis=analysis,
        session_id=session_id,
        about_me=about_me,
        past_conversations=past_conversations,
    )

    # Create per-session Runner
    runner = Runner(
        app_name=APP_NAME,
        agent=agent,
        session_service=session_service,
    )

    ws_session_id = str(uuid.uuid4())
    live_request_queue = LiveRequestQueue()

    # Transcript accumulation
    transcript_log: list[dict] = []
    pending_agent_text = []
    pending_user_text = []
    started_at = datetime.now(timezone.utc)

    def flush_pending():
        """Flush buffered partial transcripts into complete turns.

        User text is flushed before agent text because in the typical flow
        the user speaks first and the agent responds.
        """
        if pending_user_text:
            transcript_log.append({
                "role": "user",
                "text": " ".join(pending_user_text),
                "ts": time.time(),
            })
            pending_user_text.clear()
        if pending_agent_text:
            transcript_log.append({
                "role": "agent",
                "text": " ".join(pending_agent_text),
                "ts": time.time(),
            })
            pending_agent_text.clear()

    # Create ADK session
    await session_service.create_session(
        app_name=APP_NAME,
        user_id=session_id,
        session_id=ws_session_id,
    )

    # Select voice based on user's detected gender presentation
    gender = analysis.get("appearance", {}).get("gender_presentation", "").lower()
    if "female" in gender or "woman" in gender:
        voice_name = archetype.voice_name_female
    else:
        voice_name = archetype.voice_name_male

    # Run config with archetype-specific voice
    run_config = RunConfig(
        streaming_mode=StreamingMode.BIDI,
        response_modalities=["AUDIO"],
        speech_config=types.SpeechConfig(
            voice_config=types.VoiceConfig(
                prebuilt_voice_config=types.PrebuiltVoiceConfig(
                    voice_name=voice_name,
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
        finally:
            # Signal downstream to exit so gather() returns promptly
            # (without this, downstream blocks on run_live until Cloud Run timeout)
            live_request_queue.close()

    async def downstream_task():
        """Receive events from Gemini via ADK, forward to browser."""
        try:
            # Send initial greeting to trigger the future self's opening
            if past_conversations:
                greeting_text = (
                    "[System: Your younger self is back — you've talked before. "
                    "You can see them through the camera. "
                    "Welcome them back warmly. Reference something specific "
                    "from your previous conversation to show you remember. "
                    "Then ask what's happened since you last spoke. "
                    "Be genuine, be glad to see them again. Keep it brief — under 50 words.]"
                )
            else:
                greeting_text = (
                    "[System: Your younger self just appeared in front of you. "
                    "You're seeing them for the first time. "
                    "You can see them through the camera. "
                    "Take a moment — this is emotional. "
                    "Greet them warmly, then share a specific lesson from your journey — "
                    "a real moment that changed you, not generic advice. "
                    "Be genuine, be moved. Keep it brief — under 50 words.]"
                )
            greeting = types.Content(
                role="user",
                parts=[types.Part(text=greeting_text)],
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
                # The API sends incremental chunks (finished=False) then a
                # final complete transcription (finished=True). Use the final
                # when available; keep partials only as fallback.
                if hasattr(event, "output_transcription") and event.output_transcription:
                    text = event.output_transcription.text
                    if text and text.strip():
                        if event.output_transcription.finished:
                            pending_agent_text.clear()
                        pending_agent_text.append(text.strip())

                # Input transcription (what user said)
                if hasattr(event, "input_transcription") and event.input_transcription:
                    text = event.input_transcription.text
                    if text and text.strip():
                        if event.input_transcription.finished:
                            pending_user_text.clear()
                        pending_user_text.append(text.strip())

                if event.interrupted:
                    # Send accumulated transcripts before signal
                    if pending_user_text:
                        await websocket.send_text(json.dumps({
                            "type": "transcript", "role": "user",
                            "text": " ".join(pending_user_text),
                        }))
                    if pending_agent_text:
                        await websocket.send_text(json.dumps({
                            "type": "transcript", "role": "agent",
                            "text": " ".join(pending_agent_text),
                        }))
                    flush_pending()
                    await websocket.send_text(json.dumps({"type": "interrupted"}))

                if event.turn_complete:
                    # Send accumulated transcripts before signal
                    if pending_user_text:
                        await websocket.send_text(json.dumps({
                            "type": "transcript", "role": "user",
                            "text": " ".join(pending_user_text),
                        }))
                    if pending_agent_text:
                        await websocket.send_text(json.dumps({
                            "type": "transcript", "role": "agent",
                            "text": " ".join(pending_agent_text),
                        }))
                    flush_pending()
                    await websocket.send_text(json.dumps({"type": "turn_complete"}))

                    # Trigger live portrait generation
                    portrait_gen_state["turn_count"] += 1
                    if (
                        selfie_bytes
                        and portrait_gen_state["turn_count"] > 2
                        and not portrait_gen_state["in_flight"]
                    ):

                        async def _try_portrait_update():
                            try:
                                portrait_gen_state["in_flight"] = True
                                direction = await should_update_portrait(
                                    transcript_log, persona_data
                                )
                                if direction:
                                    portrait_gen_state["index"] += 1
                                    url = await generate_live_portrait(
                                        session_id=session_id,
                                        future_id=future_id,
                                        index=portrait_gen_state["index"],
                                        selfie_bytes=selfie_bytes,
                                        selfie_mime=selfie_mime,
                                        appearance=appearance,
                                        persona_data=persona_data,
                                        portrait_direction=direction,
                                        about_me=about_me,
                                    )
                                    if url:
                                        await websocket.send_text(
                                            json.dumps({"type": "portrait_update", "url": url})
                                        )
                            except Exception as e:
                                logger.error(f"Live portrait update failed: {e}", exc_info=True)
                            finally:
                                portrait_gen_state["in_flight"] = False

                        asyncio.create_task(_try_portrait_update())

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

        # Flush any remaining partial transcripts
        flush_pending()

        # Persist conversation to Supabase
        if transcript_log:
            try:
                ended_at = datetime.now(timezone.utc)
                duration = int((ended_at - started_at).total_seconds())
                insights_data = get_session_insights(session_id)
                save_conversation(
                    session_id=session_id,
                    future_id=future_id,
                    transcript=transcript_log,
                    insights=insights_data.get("insights", []),
                    started_at=started_at.isoformat(),
                    ended_at=ended_at.isoformat(),
                    duration_seconds=duration,
                )
            except Exception as e:
                logger.error(f"Failed to save conversation: {e}", exc_info=True)

        logger.info(f"Session closed: {ws_session_id}")
