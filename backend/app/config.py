import os
from dotenv import load_dotenv

load_dotenv()

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
GOOGLE_CLOUD_PROJECT = os.getenv("GOOGLE_CLOUD_PROJECT")
GOOGLE_CLOUD_LOCATION = os.getenv("GOOGLE_CLOUD_LOCATION", "us-central1")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")

APP_NAME = "mirror8"

# Gemini 2.5 Flash for text analysis + image generation
GENERATION_MODEL = "gemini-2.5-flash-preview-05-20"

# Gemini 2.5 Flash Native Audio for live conversation
LIVE_MODEL = "gemini-2.5-flash-native-audio-preview"

# Max concurrent image generations
MAX_CONCURRENT_GENERATIONS = 4
