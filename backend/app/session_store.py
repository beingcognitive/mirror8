"""Supabase-backed session storage (DB + Storage)."""

import logging
import secrets
from dataclasses import dataclass
from datetime import datetime, timezone

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


def update_session_analysis(session_id: str, analysis: dict) -> None:
    """Update the analysis JSON column for an existing session."""
    client = _get_client()
    client.table("sessions").update({"analysis": analysis}).eq("id", session_id).execute()


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


def get_conversations_for_future(session_id: str, future_id: str) -> list[dict]:
    """Fetch conversations for a specific future within a session, most recent first."""
    client = _get_client()
    result = (
        client.table("conversations")
        .select("id, future_id, started_at, ended_at, duration_seconds, transcript, insights")
        .eq("session_id", session_id)
        .eq("future_id", future_id)
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


def create_or_reenable_session_share(session_id: str, user_id: str) -> dict | None:
    """Enable sharing for a session. Returns {share_token, is_active} or None if not owned."""
    client = _get_client()

    # Verify ownership
    session = client.table("sessions").select("id").eq("id", session_id).eq("user_id", user_id).execute()
    if not session.data:
        return None

    # Check for existing share row
    existing = client.table("session_shares").select("*").eq("session_id", session_id).execute()

    if not existing.data:
        # Create new share
        result = client.table("session_shares").insert({"session_id": session_id}).execute()
        row = result.data[0]
        return {"share_token": row["share_token"], "is_active": True}

    row = existing.data[0]
    if row["is_active"]:
        # Already active — return existing token
        return {"share_token": row["share_token"], "is_active": True}

    # Re-enable with new token (old links stay dead)
    new_token = secrets.token_hex(16)
    client.table("session_shares").update({
        "share_token": new_token,
        "is_active": True,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", row["id"]).execute()
    return {"share_token": new_token, "is_active": True}


def disable_session_share(session_id: str, user_id: str) -> bool:
    """Disable sharing for a session. Returns True if found and disabled."""
    client = _get_client()

    # Verify ownership
    session = client.table("sessions").select("id").eq("id", session_id).eq("user_id", user_id).execute()
    if not session.data:
        return False

    result = client.table("session_shares").update({
        "is_active": False,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }).eq("session_id", session_id).execute()
    return bool(result.data)


def get_session_share_status(session_id: str, user_id: str) -> dict | None:
    """Get share status for a session. Returns {share_token, is_active} or None."""
    client = _get_client()

    # Verify ownership
    session = client.table("sessions").select("id").eq("id", session_id).eq("user_id", user_id).execute()
    if not session.data:
        return None

    result = client.table("session_shares").select("share_token, is_active").eq("session_id", session_id).execute()
    if not result.data:
        return None

    row = result.data[0]
    if not row["is_active"]:
        return {"share_token": None, "is_active": False}
    return {"share_token": row["share_token"], "is_active": True}


def get_shared_session(share_token: str) -> dict | None:
    """Public: fetch shared session data by token. Returns futures list or None."""
    client = _get_client()

    share = (
        client.table("session_shares")
        .select("session_id")
        .eq("share_token", share_token)
        .eq("is_active", True)
        .execute()
    )
    if not share.data:
        return None

    session_id = share.data[0]["session_id"]

    # Get session created_at (not user_id or analysis)
    session = client.table("sessions").select("created_at").eq("id", session_id).execute()
    if not session.data:
        return None

    futures = (
        client.table("futures")
        .select("name, title, archetype_id, portrait_url")
        .eq("session_id", session_id)
        .order("created_at")
        .execute()
    )

    return {
        "created_at": session.data[0]["created_at"],
        "futures": [
            {
                "name": f["name"],
                "title": f["title"],
                "archetype_id": f["archetype_id"],
                "portrait_url": f["portrait_url"],
            }
            for f in futures.data
        ],
    }


def upload_selfie(session_id: str, selfie_bytes: bytes, selfie_mime: str) -> str:
    """Upload the original selfie to Storage for later use. Returns the storage path."""
    client = _get_client()
    ext = "png" if "png" in selfie_mime else "jpg"
    path = f"{session_id}/selfie.{ext}"
    client.storage.from_("portraits").upload(
        path,
        selfie_bytes,
        {"content-type": selfie_mime},
    )
    logger.info(f"Uploaded selfie for session {session_id}: {path}")
    return path


def get_selfie_bytes(selfie_path: str) -> bytes:
    """Download selfie bytes from Storage."""
    client = _get_client()
    return client.storage.from_("portraits").download(selfie_path)


def upload_live_portrait(
    session_id: str, future_id: str, index: int, image_bytes: bytes, mime_type: str
) -> str:
    """Upload a live-generated portrait and return its public URL."""
    client = _get_client()
    ext = "png" if "png" in mime_type else "jpg"
    path = f"{session_id}/{future_id}_live_{index}.{ext}"
    client.storage.from_("portraits").upload(
        path,
        image_bytes,
        {"content-type": mime_type},
    )
    url = client.storage.from_("portraits").get_public_url(path)
    logger.info(f"Uploaded live portrait #{index} for {future_id}: {path}")
    return url
