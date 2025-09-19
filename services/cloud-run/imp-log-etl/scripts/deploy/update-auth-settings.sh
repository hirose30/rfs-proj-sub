#!/bin/bash
# 既存のCloud Runサービスの認証設定を更新するスクリプト

# 引数チェック
if [ "$#" -ne 1 ]; then
    echo "Usage: $0 <environment>"
    echo "  environment: dev, staging, or prod"
    exit 1
fi

# 環境設定
ENV=$1
PROJECT_ID="rfs-proj"
REGION="asia-northeast1"

case $ENV in
    dev)
        SERVICE_NAME="imp-log-etl-dev"
        ;;
    staging)
        SERVICE_NAME="imp-log-etl-staging"
        ;;
    prod)
        SERVICE_NAME="imp-log-etl-prod"
        ;;
    *)
        echo "Invalid environment: $ENV"
        echo "Valid environments: dev, staging, or prod"
        exit 1
        ;;
esac

# サービスアカウントの設定
SERVICE_ACCOUNT="imp-log-etl-scheduler@${PROJECT_ID}.iam.gserviceaccount.com"

# 認証設定の更新
echo "Updating authentication settings for ${SERVICE_NAME}..."
gcloud run services update ${SERVICE_NAME} \
  --region=${REGION} \
  --no-allow-unauthenticated \
  --project=${PROJECT_ID}

# サービスアカウントにCloud Run呼び出し権限を付与
echo "Granting invoker role to service account..."
gcloud run services add-iam-policy-binding ${SERVICE_NAME} \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/run.invoker" \
  --region=${REGION} \
  --project=${PROJECT_ID}

echo "Authentication settings updated for ${SERVICE_NAME}."