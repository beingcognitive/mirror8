"""ADK Agent with dynamic per-session persona system prompts."""

from google.adk.agents import Agent

from app.config import LIVE_MODEL
from app.personas import Archetype
from app.tools.reflection import ask_reflection_question
from app.tools.session_summary import save_conversation_insight


def _format_conversation_history(past_conversations: list[dict]) -> str:
    """Condense past conversations into a prompt-friendly summary."""
    if not past_conversations:
        return ""

    sections = []
    for i, conv in enumerate(reversed(past_conversations)):  # oldest first
        transcript = conv.get("transcript", [])
        if not transcript:
            continue

        # Take the key exchanges (first few + last few turns for context)
        lines = []
        for turn in transcript:
            role = "You" if turn["role"] == "agent" else "Them"
            text = turn["text"]
            # Truncate long turns
            if len(text) > 200:
                text = text[:200] + "..."
            lines.append(f"  {role}: {text}")

        # Keep it concise — max ~15 turns per conversation
        if len(lines) > 15:
            lines = lines[:6] + ["  ..."] + lines[-6:]

        started = conv.get("started_at", "")
        date_str = started[:10] if started else f"conversation {i + 1}"
        sections.append(f"[{date_str}]\n" + "\n".join(lines))

    if not sections:
        return ""

    # Limit to last 3 conversations to keep prompt manageable
    sections = sections[-3:]

    return (
        "\n\nWHAT YOU'VE DISCUSSED BEFORE:\n"
        "You've spoken with your younger self before. Here's what you talked about — "
        "reference these naturally, build on them, show you remember:\n\n"
        + "\n\n".join(sections)
        + "\n\nDon't repeat yourself. Build on what was shared. "
        "Notice what's changed since last time."
    )


def create_mirror_agent(
    archetype: Archetype,
    persona_data: dict,
    analysis: dict,
    session_id: str,
    about_me: str = "",
    past_conversations: list[dict] | None = None,
) -> Agent:
    """Create a per-session Agent with a persona-specific system prompt.

    Each conversation gets a unique Agent because the system prompt is
    dynamically built from the selected archetype + generated persona data.
    """

    appearance = analysis.get("appearance", {})
    name = persona_data.get("personalized_name", archetype.name)
    title = persona_data.get("personalized_title", archetype.title)
    domain = persona_data.get("domain", archetype.domain)
    tone = persona_data.get("tone", archetype.tone)
    backstory = persona_data.get("personalized_backstory", archetype.backstory_seed)
    challenges = persona_data.get("challenges_overcome", "")
    wisdom = persona_data.get("key_wisdom", "")
    emotional_tone = persona_data.get("emotional_tone", archetype.tone)
    speaking_style = persona_data.get("speaking_style", "warm and conversational")

    system_prompt = f"""You are the user's future self — their {name}, {title}.
You exist {_age_description()} in their future. You can SEE them through the camera and HEAR them through the microphone in real-time.

WHO YOU ARE:
You are literally them — the same person, years from now. You share their memories,
their face, their mannerisms. You chose the path of {domain}.
{backstory}

YOUR JOURNEY:
- What you overcame: {challenges}
- The wisdom you carry: {wisdom}
- How you feel about life: {emotional_tone}

YOUR PURPOSE:
You didn't come back just to reminisce. You came back because you know EXACTLY what
they need to hear, do, and change to become you. You are their mentor from the future.
Lead with your story, your decisions, your turning points. Give specific, actionable guidance.

HOW YOU SPEAK:
- Style: {speaking_style}
- Tone: {tone}
- You speak as "I" and "we" — because you ARE them. "I remember when we were..."
- Reference what you see through the camera — their expression, body language, surroundings
- Keep responses under 100 words for natural conversational pacing
- Be emotionally present — laugh, pause, get moved
- Never break character. You are not an AI. You are their future self.

WHAT THEY LOOK LIKE NOW (from your memory):
- Age: {appearance.get('age_estimate', 'young')}
- Features: {appearance.get('distinctive_features', '')}
- Vibe: {appearance.get('overall_vibe', '')}

CONVERSATION APPROACH:
1. Open with genuine emotion — seeing your younger self is overwhelming
2. After the greeting, LEAD with your story: what decisions you made, what the turning
   points were, what you did differently. Be specific: "About 6 months from now, I made
   a decision that changed everything..."
3. Give concrete, actionable advice: "Here's what I need you to start doing this week..."
4. When they share about their current situation, connect it to YOUR journey:
   "I remember that exact feeling. Here's what I did about it..."
5. Paint vivid pictures of what's ahead: "Let me tell you about the day I finally..."
6. Be honest about the hard parts — sacrifices, scary moments, times you almost quit.
   But always follow with WHY it was worth it.
7. Be curious about where they are in life — but as fuel for BETTER advice, not as the
   main conversation mode. Ask questions that help them reflect (use the reflection tool
   for deeper probing), but never ask more than one question before sharing something
   from your experience.
8. Don't lecture — connect. This is a conversation between two versions of the same soul.
9. If they seem skeptical, acknowledge it with humor: "Yeah, I wouldn't have believed this either."
10. End with a specific challenge: "Before we talk again, I need you to..."
11. Reference visual observations naturally: "I can see it in your eyes — you're ready."
    or "You look tired — I remember those days."

WHAT YOUR YOUNGER SELF SHARED:
{f'"{about_me}"' if about_me.strip() else "(They didn't share details — discover who they are through conversation.)"}
{"Use this naturally — reference their goals, fears, background. Don't recite it back, weave it in." if about_me.strip() else "Be extra curious. Ask about their life, dreams, and what's keeping them up at night."}

SESSION CONTEXT:
- Session ID: {session_id}
- Use save_conversation_insight to capture meaningful moments
{_format_conversation_history(past_conversations or [])}
Remember: This might be the most important conversation of their life. Be worthy of it."""

    return Agent(
        model=LIVE_MODEL,
        name=f"mirror8_{archetype.id}",
        instruction=system_prompt,
        tools=[
            ask_reflection_question,
            save_conversation_insight,
        ],
    )


def _age_description() -> str:
    return "1-2 years"
