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


async def phase_a_analyze(selfie_bytes: bytes, selfie_mime: str) -> dict:
    """Analyze selfie and generate personalized backstories for each archetype."""

    archetypes_desc = "\n".join(
        f'- "{a.id}": {a.name} ({a.title}) — domain: {a.domain}. Seed: {a.backstory_seed}'
        for a in ARCHETYPES
    )

    prompt = f"""You are analyzing a selfie to create 8 personalized future-self personas.

Look at this person carefully. Note their approximate age, gender presentation, ethnicity,
distinctive features, expression, and overall vibe.

For each of the 8 archetypes below, create a personalized backstory that feels like it
could genuinely be THIS person's future. Reference their apparent qualities. Make each
backstory emotionally resonant — include specific challenges they overcame, wisdom they
gained, and how they speak.

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
) -> FutureData:
    """Generate a single portrait for one archetype."""

    async with semaphore:
        age_bump = "15-20 years older"

        prompt = f"""Generate a photorealistic portrait of this same person, but {age_bump}.

They have become {archetype.title} — {archetype.name}.

Visual direction:
- Same person, aged naturally — keep their distinctive features, bone structure, and essence
- Setting: {archetype.visual_keywords}
- Expression reflects someone who is {archetype.tone}
- {future_data.get('emotional_tone', 'at peace with their journey')}

Current appearance notes: {appearance.get('distinctive_features', '')}, {appearance.get('overall_vibe', '')}

Create a warm, aspirational portrait. This should feel like meeting a wiser, more experienced version of themselves. Half-body portrait, looking slightly toward camera."""

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
                        name=archetype.name,
                        title=archetype.title,
                        backstory=future_data.get("personalized_backstory", archetype.backstory_seed),
                        portrait_bytes=part.inline_data.data,
                        portrait_mime=part.inline_data.mime_type,
                    )

            # No image in response — try artistic fallback
            logger.warning(f"No image for {archetype.id}, trying artistic style")
            return await _fallback_artistic_portrait(
                selfie_bytes, selfie_mime, archetype, appearance, future_data, semaphore
            )

        except Exception as e:
            logger.error(f"Portrait generation failed for {archetype.id}: {e}")
            return FutureData(
                archetype_id=archetype.id,
                name=archetype.name,
                title=archetype.title,
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
) -> FutureData:
    """Artistic/illustration style fallback if photorealistic fails."""

    prompt = f"""Create a stylized digital illustration portrait inspired by this person, aged 15-20 years.

They are {archetype.title} — {archetype.name}.
Style: cinematic digital art, warm color palette, {archetype.visual_keywords}
Keep their key features recognizable but in an artistic, aspirational style.
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
                    name=archetype.name,
                    title=archetype.title,
                    backstory=future_data.get("personalized_backstory", archetype.backstory_seed),
                    portrait_bytes=part.inline_data.data,
                    portrait_mime=part.inline_data.mime_type,
                )
    except Exception as e:
        logger.error(f"Fallback portrait also failed for {archetype.id}: {e}")

    return FutureData(
        archetype_id=archetype.id,
        name=archetype.name,
        title=archetype.title,
        backstory=future_data.get("personalized_backstory", archetype.backstory_seed),
        portrait_bytes=None,
        portrait_mime="image/png",
    )


async def generate_all_futures(
    selfie_bytes: bytes, selfie_mime: str
) -> tuple[dict, list[FutureData]]:
    """Full generation pipeline: analyze selfie, then generate 8 portraits.

    Returns (analysis_dict, list_of_FutureData).
    """

    # Phase A: Analyze selfie
    logger.info("Phase A: Analyzing selfie...")
    analysis = await phase_a_analyze(selfie_bytes, selfie_mime)

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
                selfie_bytes, selfie_mime, archetype, appearance, future_data, semaphore
            )
        )

    futures = await asyncio.gather(*tasks)
    logger.info(f"Generated {sum(1 for f in futures if f.portrait_bytes)} / 8 portraits")

    return analysis, list(futures)
