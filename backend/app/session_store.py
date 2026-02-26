"""Supabase-backed session storage (DB + Storage)."""

import logging
from dataclasses import dataclass

from supabase import create_client, Client

from app.config import SUPABASE_URL, SUPABASE_SECRET_KEY

logger = logging.getLogger(__name__)

_client: Client | None = None


def _get_client() -> Client:
    global _client
    if _client is None:
        _client = create_client(SUPABASE_URL, SUPABASE_SECRET_KEY)
    return _client


@dataclass
class FutureData:
    archetype_id: str
    name: str
    title: str
    backstory: str
    portrait_bytes: bytes | None = None
    portrait_mime: str = "image/png"


def create_session(user_id: str, analysis: dict) -> str:
    """Create a session in Supabase and return its UUID."""
    client = _get_client()
    result = (
        client.table("sessions")
        .insert({"user_id": user_id, "analysis": analysis})
        .execute()
    )
    session_id = result.data[0]["id"]
    logger.info(f"Created session: {session_id}")
    return session_id


def set_future(session_id: str, future: FutureData) -> str | None:
    """Insert a future row and upload portrait to Storage. Returns portrait public URL."""
    client = _get_client()

    portrait_url = None
    if future.portrait_bytes:
        ext = "png" if "png" in future.portrait_mime else "jpg"
        path = f"{session_id}/{future.archetype_id}.{ext}"
        client.storage.from_("portraits").upload(
            path,
            future.portrait_bytes,
            {"content-type": future.portrait_mime},
        )
        portrait_url = client.storage.from_("portraits").get_public_url(path)

    client.table("futures").insert({
        "session_id": session_id,
        "archetype_id": future.archetype_id,
        "name": future.name,
        "title": future.title,
        "backstory": future.backstory,
        "portrait_url": portrait_url,
    }).execute()

    return portrait_url


def get_session(session_id: str) -> dict | None:
    """Fetch session + its futures from Supabase."""
    client = _get_client()

    session_result = (
        client.table("sessions")
        .select("*")
        .eq("id", session_id)
        .execute()
    )
    if not session_result.data:
        return None

    session = session_result.data[0]

    futures_result = (
        client.table("futures")
        .select("*")
        .eq("session_id", session_id)
        .execute()
    )

    return {
        "session_id": session["id"],
        "user_id": session["user_id"],
        "analysis": session["analysis"],
        "futures": [
            {
                "id": f["archetype_id"],
                "name": f["name"],
                "title": f["title"],
                "backstory": f["backstory"],
                "portraitUrl": f["portrait_url"],
                "hasPortrait": f["portrait_url"] is not None,
            }
            for f in futures_result.data
        ],
    }


def save_conversation(
    session_id: str,
    future_id: str,
    transcript: list[dict],
    insights: list[dict],
    started_at: str,
    ended_at: str,
    duration_seconds: int,
) -> str:
    """Batch-write conversation transcript + insights to Supabase."""
    client = _get_client()
    result = (
        client.table("conversations")
        .insert({
            "session_id": session_id,
            "future_id": future_id,
            "transcript": transcript,
            "insights": insights,
            "started_at": started_at,
            "ended_at": ended_at,
            "duration_seconds": duration_seconds,
        })
        .execute()
    )
    conv_id = result.data[0]["id"]
    logger.info(f"Saved conversation {conv_id}: {len(transcript)} turns, {duration_seconds}s")
    return conv_id


def get_conversations(session_id: str) -> list[dict]:
    """Fetch all conversations for a session, most recent first."""
    client = _get_client()
    result = (
        client.table("conversations")
        .select("id, future_id, started_at, ended_at, duration_seconds, transcript, insights")
        .eq("session_id", session_id)
        .order("created_at", desc=True)
        .execute()
    )
    return result.data


def get_user_sessions(user_id: str) -> list[dict]:
    """List all sessions for a user (most recent first)."""
    client = _get_client()
    result = (
        client.table("sessions")
        .select("id, created_at")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .execute()
    )
    return result.data
