"""Tool: probe deeper into the user's life during conversation."""


def ask_reflection_question(topic: str, depth: str = "medium") -> dict:
    """Generate a structured reflection question to probe deeper into the user's life.

    Use this when you want to explore a specific aspect of the user's current life,
    dreams, fears, or relationships. This helps you give more personalized guidance
    as their future self.

    Args:
        topic: The life area to explore (e.g., "career doubts", "relationship with parents",
               "creative ambitions", "fear of failure").
        depth: How deep to go — "surface" for light questions, "medium" for meaningful,
               "deep" for vulnerable/emotional territory.

    Returns:
        A structured reflection prompt to weave naturally into conversation.
    """
    prompts = {
        "surface": f"Ask a casual, open-ended question about their {topic}. Keep it light and curious.",
        "medium": f"Ask a meaningful question about their {topic} that invites honest reflection. Reference something you 'remember' struggling with at their age.",
        "deep": f"Ask a vulnerable question about their {topic} that comes from a place of love and shared experience. Share a brief moment of your own past pain related to this.",
    }

    return {
        "topic": topic,
        "depth": depth,
        "guidance": prompts.get(depth, prompts["medium"]),
        "note": "Weave this naturally into the conversation. Don't make it feel like an interview.",
    }
