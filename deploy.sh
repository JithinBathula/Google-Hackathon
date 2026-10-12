#!/usr/bin/env bash
# Build and deploy the app (UI + API) to Cloud Run in one command: ./deploy.sh
# One-time setup it relies on (see app/README.md, "Deploy"): APIs enabled, Firestore created, the handover-app
# service account with its three roles, and the google-client-secret secret.
set -euo pipefail
cd "$(dirname "$0")"

PROJECT=${PROJECT:-gen-lang-client-0288239915}
REGION=${REGION:-asia-southeast1}
SERVICE=handover
NUMBER=$(gcloud projects describe "$PROJECT" --format='value(projectNumber)')
URL="https://$SERVICE-$NUMBER.$REGION.run.app"
# The client id is not secret (it appears in every consent URL); take it from the environment or app/.env
GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID:-$(grep '^GOOGLE_CLIENT_ID=' app/.env | cut -d= -f2-)}

# --allow-unauthenticated makes the URL public: the hackathon requires a live URL judges can open without a login.
# One instance that keeps its CPU between requests: a sync runs for minutes after its request returns,
# and the OAuth state lives in memory between /start and /callback.
gcloud run deploy "$SERVICE" --source . --project "$PROJECT" --region "$REGION" \
  --service-account "handover-app@$PROJECT.iam.gserviceaccount.com" \
  --allow-unauthenticated \
  --no-cpu-throttling --min-instances 1 --max-instances 1 \
  --memory 1Gi --timeout 900 \
  --set-env-vars "STORE=firestore,GOOGLE_CLOUD_PROJECT=$PROJECT,GOOGLE_GENAI_USE_VERTEXAI=true,GOOGLE_CLOUD_LOCATION=global,GOOGLE_CLIENT_ID=$GOOGLE_CLIENT_ID,BASE_URL=$URL/api,STORY_TODAY=2026-10-09" \
  --set-secrets "GOOGLE_CLIENT_SECRET=google-client-secret:latest"

echo "Deployed: $URL"
