import os
from dotenv import load_dotenv

load_dotenv()

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
GOOGLE_CLOUD_PROJECT = os.getenv("GOOGLE_CLOUD_PROJECT")
GOOGLE_CLOUD_LOCATION = os.getenv("GOOGLE_CLOUD_LOCATION", "us-central1")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")

APP_NAME = "mirror8"

# Phase A: text analysis (selfie → appearance + backstories)
ANALYSIS_MODEL = "gemini-3-pro-preview"

# Phase B: portrait image generation (selfie + prompt → portrait)
IMAGE_MODEL = "gemini-3.1-flash-image-preview"

# Live conversation (Gemini Native Audio)
LIVE_MODEL = "gemini-2.5-flash-native-audio-preview-12-2025"

# Supabase
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SECRET_KEY = os.getenv("SUPABASE_SECRET_KEY")  # sb_secret_* (replaces service_role)

# Max concurrent image generations
MAX_CONCURRENT_GENERATIONS = 4
