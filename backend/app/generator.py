"""Two-phase Gemini generation pipeline.

Phase A: Selfie → Gemini → appearance analysis + 8 personalized backstories
Phase B: For each archetype, selfie + prompt → Gemini → portrait image
"""

import asyncio
import base64
import json
import logging
import random
from collections.abc import Callable

from google import genai
from google.genai import types

from app.config import ANALYSIS_MODEL, ANALYSIS_MODEL_FALLBACK, IMAGE_MODEL, GOOGLE_API_KEY, MAX_CONCURRENT_GENERATIONS
from app.personas import ARCHETYPES, Archetype
from app.session_store import FutureData

logger = logging.getLogger(__name__)

client = genai.Client(api_key=GOOGLE_API_KEY)


def _build_archetype_prompt() -> str:
    """Prompt for image-only sessions — archetypes guide the 8 futures."""
    archetypes_desc = "\n".join(
        f'- "{a.id}": {a.name} ({a.title}) — domain: {a.domain}. Seed: {a.backstory_seed}'
        for a in ARCHETYPES
    )
    return f"""You are analyzing a selfie to create 8 personalized future-self personas.

Look at this person carefully. Note their approximate age, gender presentation, ethnicity,
distinctive features, expression, and overall vibe.

For each of the 8 archetypes below, create a personalized future that feels like it
could genuinely be THIS person's future. Give each future a unique personalized name
and title that reflects THIS person's specific background and goals — don't use the
generic archetype names. Reference their apparent qualities and what they shared about
themselves. Make each backstory emotionally resonant — include specific challenges they
overcame, wisdom they gained, and how they speak.

Archetypes:
{archetypes_desc}

Respond with ONLY valid JSON in this exact format:
{{{{
  "appearance": {{{{
    "age_estimate": "25-30",
    "gender_presentation": "...",
    "distinctive_features": "...",
    "overall_vibe": "..."
  }}}},
  "futures": {{{{
    "visionary": {{{{
      "personalized_name": "A short, evocative name for this future (e.g. 'The AI Pioneer')",
      "personalized_title": "A specific role title (e.g. 'Founder of an AI Startup')",
      "visual_direction": "Describe the portrait setting, attire, and mood for this specific future (e.g. 'modern startup office, casual blazer, dual monitors with code, warm confident expression')",
      "personalized_backstory": "A 2-3 sentence backstory specific to this person...",
      "challenges_overcome": "What they struggled with...",
      "key_wisdom": "Their most important life lesson...",
      "emotional_tone": "How they feel about life now...",
      "speaking_style": "How they talk — casual, formal, poetic, etc."
    }}}},
    ... (all 8 archetypes)
  }}}}
}}}}"""


def _build_image_read_prompt() -> str:
    """Prompt for image-only sessions where Gemini invents futures from the selfie alone."""
    return """You are analyzing a selfie to create 8 completely distinct possible futures for this person.

Look at this person VERY carefully. Study their age, gender presentation, ethnicity,
distinctive features, expression, clothing, accessories, background, and overall energy.

Based purely on what you SEE, imagine who this person might become. What do their eyes
say? What does their style suggest? What hidden potential do you sense? Use visual cues
to craft 8 genuinely different futures — not generic archetypes, but specific paths that
feel like they belong to THIS person.

Be bold and creative. Some futures should be surprising. Some should feel inevitable.
All should feel deeply personal to what you observe.

Respond with ONLY valid JSON in this exact format:
{
  "appearance": {
    "age_estimate": "25-30",
    "gender_presentation": "...",
    "distinctive_features": "...",
    "overall_vibe": "..."
  },
  "futures": {
    "future_1": {
      "personalized_name": "A short, evocative name for this future",
      "personalized_title": "A specific role title",
      "domain": "the life domain this future explores",
      "tone": "how this future self speaks — e.g. calm, bold, warm, poetic",
      "visual_direction": "Describe the portrait setting, attire, and mood for this specific future",
      "personalized_backstory": "A 2-3 sentence backstory specific to this person...",
      "challenges_overcome": "What they struggled with...",
      "key_wisdom": "Their most important life lesson...",
      "emotional_tone": "How they feel about life now...",
      "speaking_style": "How they talk — casual, formal, poetic, etc."
    },
    "future_2": { ... },
    ... (future_1 through future_8)
  }
}"""


def _build_freeform_prompt(about_me: str) -> str:
    """Prompt for text+image sessions — Gemini decides 8 distinct futures freely."""
    return f"""You are analyzing a selfie to create 8 completely distinct possible futures for this person.

Look at this person carefully. Note their approximate age, gender presentation, ethnicity,
distinctive features, expression, and overall vibe.

The user shared this about themselves:
"{about_me}"

Based on who they are and what they've shared, imagine 8 genuinely different possible
futures for them. Each future should explore a DIFFERENT life domain, path, or way their
aspirations could unfold. Be creative and divergent — don't just create 8 flavors of the
same thing. Think about entirely different directions their life could take.

Some futures might be unexpected or surprising. Some might connect directly to what they
shared, others might explore latent potential you see in them. Every future should feel
plausible and deeply personal.

Respond with ONLY valid JSON in this exact format:
{{{{
  "appearance": {{{{
    "age_estimate": "25-30",
    "gender_presentation": "...",
    "distinctive_features": "...",
    "overall_vibe": "..."
  }}}},
  "futures": {{{{
    "future_1": {{{{
      "personalized_name": "A short, evocative name for this future (e.g. 'The Needle Whisperer')",
      "personalized_title": "A specific role title (e.g. 'Integrative Medicine Pioneer')",
      "domain": "the life domain this future explores (e.g. 'holistic medicine & wellness')",
      "tone": "how this future self speaks — e.g. calm, bold, warm, poetic",
      "visual_direction": "Describe the portrait setting, attire, and mood for this specific future",
      "personalized_backstory": "A 2-3 sentence backstory specific to this person...",
      "challenges_overcome": "What they struggled with...",
      "key_wisdom": "Their most important life lesson...",
      "emotional_tone": "How they feel about life now...",
      "speaking_style": "How they talk — casual, formal, poetic, etc."
    }}}},
    "future_2": {{ ... }},
    ... (future_1 through future_8)
  }}}}
}}}}"""


async def phase_a_analyze(selfie_bytes: bytes, selfie_mime: str, about_me: str = "") -> dict:
    """Analyze selfie and generate personalized backstories for each archetype."""

    if about_me.strip():
        freeform = True
        prompt = _build_freeform_prompt(about_me)
    elif random.random() < 0.75:
        freeform = True
        prompt = _build_image_read_prompt()
        logger.info("Phase A mode: image-read (Gemini decides futures from selfie)")
    else:
        freeform = False
        prompt = _build_archetype_prompt()
        logger.info("Phase A mode: archetype-guided")

    models = [ANALYSIS_MODEL, ANALYSIS_MODEL_FALLBACK]
    last_error = None
    for model in models:
        max_retries = 3 if model == models[-1] else 1
        for attempt in range(max_retries):
            try:
                response = await asyncio.wait_for(
                    client.aio.models.generate_content(
                        model=model,
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
                    ),
                    timeout=30,  # 30s max per attempt — prevents Gemini SDK internal retries from hanging
                )
                text = response.text.strip()
                logger.info(f"Phase A complete via {model} ({len(text)} chars)")
                result = json.loads(text)

                # Remap neutral keys (future_1..future_8) → archetype IDs
                if freeform:
                    archetype_ids = [a.id for a in ARCHETYPES]
                    neutral_futures = result.get("futures", {})
                    remapped = {}
                    for i, aid in enumerate(archetype_ids):
                        remapped[aid] = neutral_futures.get(f"future_{i+1}", {})
                    result["futures"] = remapped

                return result
            except asyncio.TimeoutError:
                last_error = TimeoutError(f"Phase A {model} timed out after 30s")
                logger.warning(f"Phase A {model} attempt {attempt+1} timed out")
                if model != models[-1]:
                    logger.warning(f"Falling back to {models[-1]}")
                    break
                if attempt < max_retries - 1:
                    wait = (2 ** attempt) + random.random()
                    await asyncio.sleep(wait)
                    continue
                raise last_error
            except Exception as e:
                last_error = e
                err = str(e)
                if "503" in err or "500" in err:
                    if attempt < max_retries - 1:
                        wait = (2 ** attempt) + random.random()
                        logger.warning(f"Phase A {model} attempt {attempt+1} failed (503), retrying in {wait:.1f}s")
                        await asyncio.sleep(wait)
                        continue
                    if model != models[-1]:
                        logger.warning(f"Phase A {model} failed ({err[:80]}), falling back to {models[-1]}")
                        break
                    # Last model, last retry — raise
                    raise
                raise
    raise last_error  # type: ignore[misc]


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
- Expression reflects someone who is {future_data.get('tone', archetype.tone)}
- {future_data.get('emotional_tone', 'energized and thriving')}

Current appearance notes: {appearance.get('distinctive_features', '')}, {appearance.get('overall_vibe', '')}

Create an aspirational portrait. This should feel like seeing yourself on your best day — same face, just radiating success and confidence. Half-body portrait, looking slightly toward camera."""

        last_error = None
        for attempt in range(3):
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
                last_error = e
                err = str(e)
                if attempt < 2 and ("503" in err or "500" in err):
                    wait = (2 ** attempt) + random.random()
                    logger.warning(f"Portrait {archetype.id} attempt {attempt+1} failed, retrying in {wait:.1f}s")
                    await asyncio.sleep(wait)
                    continue
                break

        logger.error(f"Portrait generation failed for {archetype.id}: {last_error}")
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
    selfie_bytes: bytes, selfie_mime: str, about_me: str = "",
    on_progress: Callable[[str, dict], None] | None = None,
) -> tuple[dict, list[FutureData]]:
    """Full generation pipeline: analyze selfie, then generate 8 portraits.

    Returns (analysis_dict, list_of_FutureData).
    on_progress(event_type, data) is called at each milestone if provided.
    """

    def emit(event_type: str, **kwargs):
        if on_progress:
            on_progress(event_type, kwargs)

    # Phase A: Analyze selfie
    logger.info("Phase A: Analyzing selfie...")
    emit("analyzing")
    analysis = await phase_a_analyze(selfie_bytes, selfie_mime, about_me)
    emit("analysis_complete")

    appearance = analysis.get("appearance", {})
    futures_data = analysis.get("futures", {})

    # Phase B: Generate portraits concurrently (max 2 at a time)
    logger.info("Phase B: Generating 8 portraits...")
    semaphore = asyncio.Semaphore(MAX_CONCURRENT_GENERATIONS)
    portraits_done = {"count": 0}

    async def _generate_with_progress(archetype, future_data):
        result = await phase_b_generate_portrait(
            selfie_bytes, selfie_mime, archetype, appearance, future_data, semaphore, about_me
        )
        portraits_done["count"] += 1
        name = future_data.get("personalized_name", archetype.name)
        emit("portrait_done", index=portraits_done["count"], total=8, name=name)
        return result

    tasks = []
    for archetype in ARCHETYPES:
        future_data = futures_data.get(archetype.id, {})
        tasks.append(_generate_with_progress(archetype, future_data))

    emit("portraits_starting", total=8)
    futures = await asyncio.gather(*tasks)
    logger.info(f"Generated {sum(1 for f in futures if f.portrait_bytes)} / 8 portraits")

    return analysis, list(futures)
