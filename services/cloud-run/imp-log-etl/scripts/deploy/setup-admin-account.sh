#!/bin/bash
# 管理者用サービスアカウントの設定スクリプト

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

# 管理者用サービスアカウントの名前
ADMIN_SERVICE_ACCOUNT="imp-log-etl-admin@${PROJECT_ID}.iam.gserviceaccount.com"

# サービスアカウントが存在するか確認
if gcloud iam service-accounts describe ${ADMIN_SERVICE_ACCOUNT} --project=${PROJECT_ID} &>/dev/null; then
    echo "Admin service account already exists: ${ADMIN_SERVICE_ACCOUNT}"
else
    # 管理者用サービスアカウントの作成
    echo "Creating admin service account..."
    gcloud iam service-accounts create imp-log-etl-admin \
        --display-name="Imp Log ETL Admin Service Account" \
        --project=${PROJECT_ID}
fi

# サービスアカウントにCloud Run呼び出し権限を付与
echo "Granting invoker role to admin service account..."
gcloud run services add-iam-policy-binding ${SERVICE_NAME} \
  --member="serviceAccount:${ADMIN_SERVICE_ACCOUNT}" \
  --role="roles/run.invoker" \
  --region=${REGION} \
  --project=${PROJECT_ID}

# サービスアカウントキーの作成（オプション）
# 注意: サービスアカウントキーの作成は必要な場合のみ行ってください
# セキュリティ上のベストプラクティスとして、可能な限りキーの使用は避けることをお勧めします
if [ "$2" = "--create-key" ]; then
    echo "Creating service account key..."
    KEY_FILE="imp-log-etl-admin-key-${ENV}.json"
    gcloud iam service-accounts keys create ${KEY_FILE} \
        --iam-account=${ADMIN_SERVICE_ACCOUNT} \
        --project=${PROJECT_ID}
    echo "Service account key created: ${KEY_FILE}"
    echo "IMPORTANT: Keep this key secure and do not commit it to version control!"
else
    echo "Service account key not created. Use --create-key option to create a key if needed."
fi

echo "Admin service account setup completed for ${ENV} environment."
echo ""
echo "To use this service account for manual operations, you can:"
echo "1. Use gcloud auth as the service account (recommended):"
echo "   gcloud auth activate-service-account ${ADMIN_SERVICE_ACCOUNT} --key-file=PATH_TO_KEY_FILE"
echo ""
echo "2. Use curl with an ID token:"
echo "   TOKEN=\$(gcloud auth print-identity-token --impersonate-service-account=${ADMIN_SERVICE_ACCOUNT})"
echo "   curl -H \"Authorization: Bearer \${TOKEN}\" https://${SERVICE_NAME}-xxxxx.run.app/run"
echo ""
echo "3. For reprocessing, use:"
echo "   curl -X POST -H \"Authorization: Bearer \${TOKEN}\" -H \"Content-Type: application/json\" -d '{\"date\":\"YYYY-MM-DD\"}' https://${SERVICE_NAME}-xxxxx.run.app/reprocess"