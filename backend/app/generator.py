"""Two-phase Gemini generation pipeline.

Phase A: Selfie → Gemini → appearance analysis + 8 personalized backstories
Phase B: For each archetype, selfie + prompt → Gemini → portrait image
"""

import asyncio
import base64
import json
import logging

from google import genai
from google.genai import types

from app.config import ANALYSIS_MODEL, IMAGE_MODEL, GOOGLE_API_KEY, MAX_CONCURRENT_GENERATIONS
from app.personas import ARCHETYPES, Archetype
from app.session_store import FutureData

logger = logging.getLogger(__name__)

client = genai.Client(api_key=GOOGLE_API_KEY)


async def phase_a_analyze(selfie_bytes: bytes, selfie_mime: str, about_me: str = "") -> dict:
    """Analyze selfie and generate personalized backstories for each archetype."""

    archetypes_desc = "\n".join(
        f'- "{a.id}": {a.name} ({a.title}) — domain: {a.domain}. Seed: {a.backstory_seed}'
        for a in ARCHETYPES
    )

    user_context = ""
    if about_me.strip():
        user_context = f"""
The user shared this about themselves:
"{about_me}"

Use this to make each backstory deeply personal — reference their actual goals, age,
background, and aspirations. If they mentioned a specific goal, make sure futures
connect to it. Their self-description is MORE reliable than visual guesses.
"""

    prompt = f"""You are analyzing a selfie to create 8 personalized future-self personas.

Look at this person carefully. Note their approximate age, gender presentation, ethnicity,
distinctive features, expression, and overall vibe.
{user_context}
For each of the 8 archetypes below, create a personalized future that feels like it
could genuinely be THIS person's future. Give each future a unique personalized name
and title that reflects THIS person's specific background and goals — don't use the
generic archetype names. Reference their apparent qualities and what they shared about
themselves. Make each backstory emotionally resonant — include specific challenges they
overcame, wisdom they gained, and how they speak.

Archetypes:
{archetypes_desc}

Respond with ONLY valid JSON in this exact format:
{{
  "appearance": {{
    "age_estimate": "25-30",
    "gender_presentation": "...",
    "distinctive_features": "...",
    "overall_vibe": "..."
  }},
  "futures": {{
    "visionary": {{
      "personalized_name": "A short, evocative name for this future (e.g. 'The AI Pioneer')",
      "personalized_title": "A specific role title (e.g. 'Founder of an AI Startup')",
      "visual_direction": "Describe the portrait setting, attire, and mood for this specific future (e.g. 'modern startup office, casual blazer, dual monitors with code, warm confident expression')",
      "personalized_backstory": "A 2-3 sentence backstory specific to this person...",
      "challenges_overcome": "What they struggled with...",
      "key_wisdom": "Their most important life lesson...",
      "emotional_tone": "How they feel about life now...",
      "speaking_style": "How they talk — casual, formal, poetic, etc."
    }},
    ... (all 8 archetypes)
  }}
}}"""

    response = await client.aio.models.generate_content(
        model=ANALYSIS_MODEL,
        contents=[
            types.Content(
                parts=[
                    types.Part.from_bytes(data=selfie_bytes, mime_type=selfie_mime),
                    types.Part.from_text(text=prompt),
                ]
            )
        ],
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            temperature=0.9,
        ),
    )

    text = response.text.strip()
    logger.info(f"Phase A analysis complete ({len(text)} chars)")
    return json.loads(text)


async def phase_b_generate_portrait(
    selfie_bytes: bytes,
    selfie_mime: str,
    archetype: Archetype,
    appearance: dict,
    future_data: dict,
    semaphore: asyncio.Semaphore,
    about_me: str = "",
) -> FutureData:
    """Generate a single portrait for one archetype."""

    name = future_data.get("personalized_name", archetype.name)
    title = future_data.get("personalized_title", archetype.title)
    visual = future_data.get("visual_direction", archetype.visual_keywords)
    user_hint = f"\nAbout this person: {about_me}" if about_me.strip() else ""

    async with semaphore:
        prompt = f"""Generate a photorealistic portrait of this same person, but 1-2 years from now after achieving success.

They have become {title} — {name}.
{user_hint}
Visual direction:
- Same person, same age — do NOT age them. Keep their exact face, features, bone structure
- They look more confident, polished, and fulfilled — the glow of someone who made it
- Setting and style: {visual}
- Expression reflects someone who is {archetype.tone}
- {future_data.get('emotional_tone', 'energized and thriving')}

Current appearance notes: {appearance.get('distinctive_features', '')}, {appearance.get('overall_vibe', '')}

Create an aspirational portrait. This should feel like seeing yourself on your best day — same face, just radiating success and confidence. Half-body portrait, looking slightly toward camera."""

        try:
            response = await client.aio.models.generate_content(
                model=IMAGE_MODEL,
                contents=[
                    types.Content(
                        parts=[
                            types.Part.from_bytes(
                                data=selfie_bytes, mime_type=selfie_mime
                            ),
                            types.Part.from_text(text=prompt),
                        ]
                    )
                ],
                config=types.GenerateContentConfig(
                    response_modalities=["IMAGE", "TEXT"],
                    temperature=0.8,
                ),
            )

            # Extract image from response
            for part in response.candidates[0].content.parts:
                if part.inline_data and part.inline_data.mime_type.startswith("image/"):
                    logger.info(
                        f"Portrait generated for {archetype.id} "
                        f"({len(part.inline_data.data)} bytes)"
                    )
                    return FutureData(
                        archetype_id=archetype.id,
                        name=name,
                        title=title,
                        backstory=future_data.get("personalized_backstory", archetype.backstory_seed),
                        portrait_bytes=part.inline_data.data,
                        portrait_mime=part.inline_data.mime_type,
                    )

            # No image in response — try artistic fallback
            logger.warning(f"No image for {archetype.id}, trying artistic style")
            return await _fallback_artistic_portrait(
                selfie_bytes, selfie_mime, archetype, appearance, future_data, semaphore, about_me
            )

        except Exception as e:
            logger.error(f"Portrait generation failed for {archetype.id}: {e}")
            return FutureData(
                archetype_id=archetype.id,
                name=name,
                title=title,
                backstory=future_data.get("personalized_backstory", archetype.backstory_seed),
                portrait_bytes=None,
                portrait_mime="image/png",
            )


async def _fallback_artistic_portrait(
    selfie_bytes: bytes,
    selfie_mime: str,
    archetype: Archetype,
    appearance: dict,
    future_data: dict,
    semaphore: asyncio.Semaphore,
    about_me: str = "",
) -> FutureData:
    """Artistic/illustration style fallback if photorealistic fails."""

    name = future_data.get("personalized_name", archetype.name)
    title = future_data.get("personalized_title", archetype.title)
    visual = future_data.get("visual_direction", archetype.visual_keywords)
    user_hint = f"\nAbout this person: {about_me}" if about_me.strip() else ""

    prompt = f"""Create a stylized digital illustration portrait inspired by this person, 1-2 years from now after achieving success.

They are {title} — {name}.
{user_hint}
Style: cinematic digital art, warm color palette, {visual}
Same face, same age — do NOT age them. Show them looking confident and successful.
Half-body portrait, warm lighting."""

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
                temperature=1.0,
            ),
        )

        for part in response.candidates[0].content.parts:
            if part.inline_data and part.inline_data.mime_type.startswith("image/"):
                return FutureData(
                    archetype_id=archetype.id,
                    name=name,
                    title=title,
                    backstory=future_data.get("personalized_backstory", archetype.backstory_seed),
                    portrait_bytes=part.inline_data.data,
                    portrait_mime=part.inline_data.mime_type,
                )
    except Exception as e:
        logger.error(f"Fallback portrait also failed for {archetype.id}: {e}")

    return FutureData(
        archetype_id=archetype.id,
        name=name,
        title=title,
        backstory=future_data.get("personalized_backstory", archetype.backstory_seed),
        portrait_bytes=None,
        portrait_mime="image/png",
    )


async def generate_all_futures(
    selfie_bytes: bytes, selfie_mime: str, about_me: str = ""
) -> tuple[dict, list[FutureData]]:
    """Full generation pipeline: analyze selfie, then generate 8 portraits.

    Returns (analysis_dict, list_of_FutureData).
    """

    # Phase A: Analyze selfie
    logger.info("Phase A: Analyzing selfie...")
    analysis = await phase_a_analyze(selfie_bytes, selfie_mime, about_me)

    appearance = analysis.get("appearance", {})
    futures_data = analysis.get("futures", {})

    # Phase B: Generate portraits concurrently (max 4 at a time)
    logger.info("Phase B: Generating 8 portraits...")
    semaphore = asyncio.Semaphore(MAX_CONCURRENT_GENERATIONS)

    tasks = []
    for archetype in ARCHETYPES:
        future_data = futures_data.get(archetype.id, {})
        tasks.append(
            phase_b_generate_portrait(
                selfie_bytes, selfie_mime, archetype, appearance, future_data, semaphore, about_me
            )
        )

    futures = await asyncio.gather(*tasks)
    logger.info(f"Generated {sum(1 for f in futures if f.portrait_bytes)} / 8 portraits")

    return analysis, list(futures)
