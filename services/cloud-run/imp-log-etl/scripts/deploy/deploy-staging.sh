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
  --no-allow-unauthenticated \
  --memory 512Mi \
  --cpu 1 \
  --concurrency 80 \
  --timeout 300 \
  --set-env-vars "NODE_ENV=staging" \
  --project ${PROJECT_ID}

# サービスアカウントの設定
SERVICE_ACCOUNT="imp-log-etl-scheduler@${PROJECT_ID}.iam.gserviceaccount.com"

# サービスアカウントにCloud Run呼び出し権限を付与
echo "Granting invoker role to service account..."
gcloud run services add-iam-policy-binding ${SERVICE_NAME} \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/run.invoker" \
  --region=${REGION} \
  --project=${PROJECT_ID}

echo "Deployment to staging environment completed."