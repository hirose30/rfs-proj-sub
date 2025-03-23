#!/bin/bash
# Cloud Schedulerの設定スクリプト

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
        JOB_NAME="imp-log-etl-daily-dev"
        ;;
    staging)
        SERVICE_NAME="imp-log-etl-staging"
        JOB_NAME="imp-log-etl-daily-staging"
        ;;
    prod)
        SERVICE_NAME="imp-log-etl-prod"
        JOB_NAME="imp-log-etl-daily-prod"
        ;;
    *)
        echo "Invalid environment: $ENV"
        echo "Valid environments: dev, staging, or prod"
        exit 1
        ;;
esac

# サービスURLの取得
SERVICE_URL=$(gcloud run services describe ${SERVICE_NAME} \
    --platform managed \
    --region ${REGION} \
    --project ${PROJECT_ID} \
    --format="value(status.url)")

if [ -z "$SERVICE_URL" ]; then
    echo "Error: Could not retrieve service URL for ${SERVICE_NAME}"
    exit 1
fi

# サービスアカウントの設定
SERVICE_ACCOUNT="imp-log-etl-scheduler@${PROJECT_ID}.iam.gserviceaccount.com"

# Cloud Schedulerジョブの作成
echo "Creating Cloud Scheduler job for ${ENV} environment..."
gcloud scheduler jobs create http ${JOB_NAME} \
    --schedule="15 0 * * *" \
    --time-zone="Asia/Tokyo" \
    --uri="${SERVICE_URL}/run" \
    --http-method=GET \
    --oidc-service-account-email=${SERVICE_ACCOUNT} \
    --oidc-token-audience="${SERVICE_URL}" \
    --project ${PROJECT_ID}

echo "Cloud Scheduler job for ${ENV} environment created successfully."