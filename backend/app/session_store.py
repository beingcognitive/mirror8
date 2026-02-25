"""In-memory session storage for hackathon (single instance)."""

import logging
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


@dataclass
class FutureData:
    archetype_id: str
    name: str
    title: str
    backstory: str
    portrait_bytes: bytes | None = None
    portrait_mime: str = "image/png"


@dataclass
class Session:
    session_id: str
    selfie_bytes: bytes
    selfie_mime: str
    analysis: dict | None = None
    futures: dict[str, FutureData] = field(default_factory=dict)


_sessions: dict[str, Session] = {}


def create_session(session_id: str, selfie_bytes: bytes, selfie_mime: str) -> Session:
    session = Session(
        session_id=session_id,
        selfie_bytes=selfie_bytes,
        selfie_mime=selfie_mime,
    )
    _sessions[session_id] = session
    logger.info(f"Created session: {session_id}")
    return session


def get_session(session_id: str) -> Session | None:
    return _sessions.get(session_id)


def set_analysis(session_id: str, analysis: dict) -> None:
    session = _sessions.get(session_id)
    if session:
        session.analysis = analysis


def set_future(session_id: str, future: FutureData) -> None:
    session = _sessions.get(session_id)
    if session:
        session.futures[future.archetype_id] = future


def delete_session(session_id: str) -> None:
    _sessions.pop(session_id, None)
    logger.info(f"Deleted session: {session_id}")
