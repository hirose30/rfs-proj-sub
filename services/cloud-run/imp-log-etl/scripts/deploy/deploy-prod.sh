#!/bin/bash
# 本番環境へのデプロイスクリプト

# 変数設定
PROJECT_ID="rfs-proj"
SERVICE_NAME="imp-log-etl-prod"
REGION="asia-northeast1"
IMAGE_NAME="imp-log-etl:latest"
GCR_HOSTNAME="gcr.io"
GCR_IMAGE="${GCR_HOSTNAME}/${PROJECT_ID}/${SERVICE_NAME}"

# イメージにタグ付け
echo "Tagging image for production environment..."
docker tag ${IMAGE_NAME} ${GCR_IMAGE}

# GCRにプッシュ
echo "Pushing image to Google Container Registry..."
docker push ${GCR_IMAGE}

# Cloud Runにデプロイ
echo "Deploying to Cloud Run (production environment)..."
gcloud run deploy ${SERVICE_NAME} \
  --image ${GCR_IMAGE} \
  --platform managed \
  --region ${REGION} \
  --no-allow-unauthenticated \
  --memory 1Gi \
  --cpu 2 \
  --concurrency 80 \
  --timeout 300 \
  --set-env-vars "NODE_ENV=production" \
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

echo "Deployment to production environment completed."