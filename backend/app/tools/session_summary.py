"""Tool: save conversation insights during the session."""

import logging

logger = logging.getLogger(__name__)

_session_insights: dict[str, list[dict]] = {}


def save_conversation_insight(
    session_id: str,
    insight_type: str,
    content: str,
) -> dict:
    """Save an important insight or moment from the conversation.

    Call this when you learn something meaningful about the user — their dreams,
    fears, breakthroughs, or emotional moments. This helps maintain continuity
    and could be used for a post-session summary.

    Args:
        session_id: The current session identifier.
        insight_type: Category — "dream", "fear", "breakthrough", "memory", "goal", "emotion".
        content: A brief description of the insight (1-2 sentences).

    Returns:
        Confirmation of the saved insight.
    """
    if session_id not in _session_insights:
        _session_insights[session_id] = []

    insight = {"type": insight_type, "content": content}
    _session_insights[session_id].append(insight)
    logger.info(f"Saved insight for {session_id}: [{insight_type}] {content[:60]}")

    return {
        "status": "saved",
        "total_insights": len(_session_insights[session_id]),
        "message": f"Noted. You've captured {len(_session_insights[session_id])} insights so far.",
    }


def get_session_insights(session_id: str) -> dict:
    """Retrieve all insights saved during this session.

    Args:
        session_id: The session identifier.

    Returns:
        All saved insights for this session.
    """
    insights = _session_insights.get(session_id, [])
    return {
        "session_id": session_id,
        "insights": insights,
        "total": len(insights),
    }
