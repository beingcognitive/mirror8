#!/bin/bash
set -euo pipefail

# Mirror8 backend deployment to Google Cloud Run
# Frontend is auto-deployed via Cloudflare Pages on push.
# Usage: ./deploy.sh

REGION="${GOOGLE_CLOUD_LOCATION:-us-central1}"
SERVICE="mirror8-api"

echo "=== Deploying backend ==="
cd "$(dirname "$0")/../backend"

gcloud run deploy "$SERVICE" \
  --source=. \
  --region="$REGION"

echo "=== Deployment complete ==="
