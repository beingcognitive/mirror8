#!/bin/bash
set -euo pipefail

# Mirror8 deployment to Google Cloud Run
# Usage: ./deploy.sh [backend|frontend|all]

PROJECT_ID="${GOOGLE_CLOUD_PROJECT:-}"
REGION="${GOOGLE_CLOUD_LOCATION:-us-central1}"
BACKEND_SERVICE="mirror8-api"
FRONTEND_SERVICE="mirror8-web"

if [ -z "$PROJECT_ID" ]; then
  echo "Error: GOOGLE_CLOUD_PROJECT not set"
  exit 1
fi

deploy_backend() {
  echo "=== Deploying backend ==="
  cd "$(dirname "$0")/../backend"

  gcloud run deploy "$BACKEND_SERVICE" \
    --source=. \
    --project="$PROJECT_ID" \
    --region="$REGION" \
    --allow-unauthenticated \
    --timeout=900 \
    --session-affinity \
    --memory=1Gi \
    --cpu=2 \
    --min-instances=0 \
    --max-instances=3 \
    --set-env-vars="GOOGLE_API_KEY=${GOOGLE_API_KEY:-}" \
    --set-env-vars="FRONTEND_URL=${FRONTEND_URL:-https://mirror8.app}"

  BACKEND_URL=$(gcloud run services describe "$BACKEND_SERVICE" \
    --project="$PROJECT_ID" --region="$REGION" \
    --format='value(status.url)')
  echo "Backend deployed: $BACKEND_URL"
}

deploy_frontend() {
  echo "=== Deploying frontend ==="
  cd "$(dirname "$0")/../frontend"

  # Build with production API URL
  NEXT_PUBLIC_API_URL="${BACKEND_URL:-https://mirror8-api-${REGION}.run.app}"
  NEXT_PUBLIC_WS_URL="${NEXT_PUBLIC_API_URL/https:/wss:}"

  cat > .env.production <<EOF
NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
NEXT_PUBLIC_WS_URL=${NEXT_PUBLIC_WS_URL}
EOF

  # Create Dockerfile for frontend
  cat > Dockerfile <<'DOCKERFILE'
FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
DOCKERFILE

  gcloud run deploy "$FRONTEND_SERVICE" \
    --source=. \
    --project="$PROJECT_ID" \
    --region="$REGION" \
    --allow-unauthenticated \
    --timeout=60 \
    --memory=512Mi \
    --cpu=1 \
    --min-instances=0 \
    --max-instances=3

  FRONTEND_URL=$(gcloud run services describe "$FRONTEND_SERVICE" \
    --project="$PROJECT_ID" --region="$REGION" \
    --format='value(status.url)')
  echo "Frontend deployed: $FRONTEND_URL"

  # Clean up generated files
  rm -f Dockerfile .env.production
}

case "${1:-all}" in
  backend)
    deploy_backend
    ;;
  frontend)
    deploy_frontend
    ;;
  all)
    deploy_backend
    deploy_frontend
    ;;
  *)
    echo "Usage: $0 [backend|frontend|all]"
    exit 1
    ;;
esac

echo "=== Deployment complete ==="
