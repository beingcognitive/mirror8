"""LLM-driven live portrait generation during conversation.

Two-step process:
1. Ask a fast model whether the conversation warrants a portrait update
2. If yes, generate a new portrait using the LLM's creative direction
"""

import json
import logging

from google import genai
from google.genai import types

from app.config import ANALYSIS_MODEL_FALLBACK, IMAGE_MODEL, GOOGLE_API_KEY
from app.session_store import upload_live_portrait

logger = logging.getLogger(__name__)

client = genai.Client(api_key=GOOGLE_API_KEY)


async def should_update_portrait(
    transcript_log: list[dict],
    persona_data: dict,
) -> dict | None:
    """Ask a fast LLM whether the conversation warrants a new portrait.

    Returns a dict with expression/pose/mood/setting_adjustment if yes, None otherwise.
    """
    # Take the last ~6 entries for context
    recent = transcript_log[-6:]
    if not recent:
        return None

    conversation_text = "\n".join(
        f"{'Future self' if e['role'] == 'agent' else 'User'}: {e['text']}"
        for e in recent
    )

    name = persona_data.get("personalized_name", "the future self")
    title = persona_data.get("personalized_title", "")

    prompt = f"""You are observing a live conversation between a person and their future self ({name}, {title}).

Recent conversation:
{conversation_text}

Based on the emotional arc of this conversation, should we update the portrait to reflect a new expression, pose, or mood? Update only at emotionally meaningful moments — a breakthrough, a shift in tone, a moment of vulnerability, joy, or revelation. Do NOT update for mundane exchanges.

Reply with ONLY valid JSON:
{{"update": true/false, "reason": "brief explanation", "expression": "facial expression description", "pose": "body language/pose", "mood": "emotional quality", "setting_adjustment": "any change to background/lighting/atmosphere"}}"""

    try:
        response = await client.aio.models.generate_content(
            model=ANALYSIS_MODEL_FALLBACK,
            contents=[types.Content(parts=[types.Part.from_text(text=prompt)])],
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0.7,
            ),
        )
        result = json.loads(response.text.strip())
        if result.get("update"):
            logger.info(f"Portrait update triggered: {result.get('reason', 'no reason')}")
            return result
        logger.info(f"Portrait update skipped: {result.get('reason', 'no reason')}")
        return None
    except Exception as e:
        logger.error(f"should_update_portrait failed: {e}")
        return None


async def generate_live_portrait(
    session_id: str,
    future_id: str,
    index: int,
    selfie_bytes: bytes,
    selfie_mime: str,
    appearance: dict,
    persona_data: dict,
    portrait_direction: dict,
    about_me: str = "",
) -> str | None:
    """Generate a new portrait reflecting the conversation's emotional moment.

    Returns the public URL of the uploaded portrait, or None on failure.
    """
    name = persona_data.get("personalized_name", "future self")
    title = persona_data.get("personalized_title", "")
    visual = persona_data.get("visual_direction", "")

    expression = portrait_direction.get("expression", "thoughtful")
    pose = portrait_direction.get("pose", "relaxed")
    mood = portrait_direction.get("mood", "warm")
    setting = portrait_direction.get("setting_adjustment", visual)

    user_hint = f"\nAbout this person: {about_me}" if about_me.strip() else ""

    prompt = f"""Generate a photorealistic portrait of this same person as {title} — {name}.
{user_hint}
This is an updated portrait reflecting a specific emotional moment in a conversation.

Expression: {expression}
Pose: {pose}
Mood: {mood}
Setting: {setting or visual}

Current appearance notes: {appearance.get('distinctive_features', '')}, {appearance.get('overall_vibe', '')}

IMPORTANT: Same person, same age — do NOT age them. Keep their exact face, features, bone structure.
Half-body portrait, looking slightly toward camera."""

    try:
        response = await client.aio.models.generate_content(
            model=IMAGE_MODEL,
            contents=[
                types.Content(
                    parts=[
                        types.Part.from_bytes(data=selfie_bytes, mime_type=selfie_mime),
                        types.Part.from_text(text=prompt),
                    ]
                )
            ],
            config=types.GenerateContentConfig(
                response_modalities=["IMAGE", "TEXT"],
                temperature=0.8,
            ),
        )

        for part in response.candidates[0].content.parts:
            if part.inline_data and part.inline_data.mime_type.startswith("image/"):
                url = upload_live_portrait(
                    session_id, future_id, index,
                    part.inline_data.data, part.inline_data.mime_type,
                )
                logger.info(f"Live portrait #{index} generated for {future_id}")
                return url

        logger.warning(f"No image in live portrait response for {future_id}")
        return None
    except Exception as e:
        logger.error(f"generate_live_portrait failed: {e}")
        return None
