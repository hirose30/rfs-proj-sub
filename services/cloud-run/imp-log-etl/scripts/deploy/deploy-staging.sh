#!/bin/bash
# ステージング環境へのデプロイスクリプト

# 変数設定
PROJECT_ID="rfs-proj"
SERVICE_NAME="imp-log-etl-staging"
REGION="asia-northeast1"
IMAGE_NAME="imp-log-etl:latest"
GCR_HOSTNAME="gcr.io"
GCR_IMAGE="${GCR_HOSTNAME}/${PROJECT_ID}/${SERVICE_NAME}"

# イメージにタグ付け
echo "Tagging image for staging environment..."
docker tag ${IMAGE_NAME} ${GCR_IMAGE}

# GCRにプッシュ
echo "Pushing image to Google Container Registry..."
docker push ${GCR_IMAGE}

# Cloud Runにデプロイ
echo "Deploying to Cloud Run (staging environment)..."
gcloud run deploy ${SERVICE_NAME} \
  --image ${GCR_IMAGE} \
  --platform managed \
  --region ${REGION} \
  --allow-unauthenticated \
  --memory 512Mi \
  --cpu 1 \
  --concurrency 80 \
  --timeout 300 \
  --set-env-vars "NODE_ENV=staging" \
  --project ${PROJECT_ID}

echo "Deployment to staging environment completed."