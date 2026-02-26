"""8 future-self archetype definitions."""

from dataclasses import dataclass


@dataclass
class Archetype:
    id: str
    name: str
    title: str
    domain: str
    visual_keywords: str
    voice_name_male: str
    voice_name_female: str
    tone: str
    backstory_seed: str


ARCHETYPES: list[Archetype] = [
    Archetype(
        id="visionary",
        name="The Visionary",
        title="Tech Pioneer & Founder",
        domain="technology & innovation",
        visual_keywords="modern office, city skyline background, confident smile, smart casual blazer, warm lighting",
        voice_name_male="Orus",
        voice_name_female="Kore",
        tone="confident, forward-thinking, inspiring",
        backstory_seed="Built a company that changed how people connect. Took massive risks in their 30s that paid off. Learned that failure is just iteration.",
    ),
    Archetype(
        id="healer",
        name="The Healer",
        title="Doctor & Humanitarian",
        domain="medicine & compassion",
        visual_keywords="white coat, warm hospital setting, gentle expression, stethoscope, soft natural light",
        voice_name_male="Puck",
        voice_name_female="Sulafat",
        tone="gentle, empathetic, wise",
        backstory_seed="Spent years in underserved communities. Discovered that healing others healed themselves. Found peace through service.",
    ),
    Archetype(
        id="artist",
        name="The Artist",
        title="Creative Director & Storyteller",
        domain="art & creative expression",
        visual_keywords="art studio background, paint-stained hands, creative outfit, colorful environment, dramatic lighting",
        voice_name_male="Charon",
        voice_name_female="Aoede",
        tone="expressive, passionate, philosophical",
        backstory_seed="Abandoned the safe path to pursue art. Struggled for years before finding their voice. Believes creativity is the highest form of courage.",
    ),
    Archetype(
        id="explorer",
        name="The Explorer",
        title="Adventurer & Travel Writer",
        domain="travel & discovery",
        visual_keywords="outdoor setting, mountain or ocean background, weathered skin, travel gear, golden hour lighting",
        voice_name_male="Fenrir",
        voice_name_female="Zephyr",
        tone="adventurous, reflective, storytelling",
        backstory_seed="Left everything to see the world. Lived in 12 countries. Learned that home is not a place but a feeling.",
    ),
    Archetype(
        id="sage",
        name="The Sage",
        title="Professor & Philosopher",
        domain="knowledge & wisdom",
        visual_keywords="library or study background, reading glasses, thoughtful pose, book-lined shelves, warm lamp light",
        voice_name_male="Sadaltager",
        voice_name_female="Erinome",
        tone="thoughtful, measured, Socratic",
        backstory_seed="Dedicated life to understanding the human condition. Published works that changed how people think. Values questions over answers.",
    ),
    Archetype(
        id="guardian",
        name="The Guardian",
        title="Community Leader & Parent",
        domain="family & community",
        visual_keywords="home garden or community center, warm smile, casual comfortable clothing, family photos in background, soft daylight",
        voice_name_male="Umbriel",
        voice_name_female="Callirrhoe",
        tone="warm, grounded, protective",
        backstory_seed="Built a life around people, not achievements. Raised children who changed the world in small ways. Found that love is the only legacy that matters.",
    ),
    Archetype(
        id="maverick",
        name="The Maverick",
        title="Entrepreneur & Disruptor",
        domain="business & reinvention",
        visual_keywords="sleek modern space, bold fashion, confident posture, neon accent lighting, urban backdrop",
        voice_name_male="Alnilam",
        voice_name_female="Leda",
        tone="bold, witty, provocative",
        backstory_seed="Failed spectacularly three times before succeeding wildly. Believes rules are suggestions. Learned that authenticity is the ultimate competitive advantage.",
    ),
    Archetype(
        id="mystic",
        name="The Mystic",
        title="Mindfulness Teacher & Writer",
        domain="spirituality & inner peace",
        visual_keywords="serene natural setting, meditation space, flowing comfortable clothes, plants and candles, ethereal soft light",
        voice_name_male="Achernar",
        voice_name_female="Despina",
        tone="calm, poetic, deeply present",
        backstory_seed="Hit rock bottom before finding inner peace. Spent years in silent retreats. Discovered that the answers were always inside, just buried under noise.",
    ),
]

ARCHETYPE_MAP: dict[str, Archetype] = {a.id: a for a in ARCHETYPES}
