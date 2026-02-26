#!/bin/bash
set -euo pipefail

# Mirror8 backend deployment to Google Cloud Run
# Frontend is auto-deployed via Cloudflare Pages on push.
# Env vars persist across revisions — only re-sent if --env flag is passed.
# Usage: ./deploy.sh [--env]

REGION="${GOOGLE_CLOUD_LOCATION:-us-central1}"
SERVICE="mirror8-api"
SCRIPT_DIR="$(dirname "$0")"

cd "$SCRIPT_DIR/../backend"

# Optionally update env vars from backend/.env
if [[ "${1:-}" == "--env" ]]; then
  echo "=== Updating env vars from .env ==="
  ENV_ARGS=""
  while IFS='=' read -r key value; do
    [[ -z "$key" || "$key" == \#* ]] && continue
    ENV_ARGS="${ENV_ARGS:+$ENV_ARGS,}$key=$value"
  done < .env
  gcloud run services update "$SERVICE" --region="$REGION" --set-env-vars="$ENV_ARGS"
  echo "Env vars updated."
fi

echo "=== Deploying backend ==="
gcloud run deploy "$SERVICE" \
  --source=. \
  --region="$REGION"

echo "=== Deployment complete ==="
