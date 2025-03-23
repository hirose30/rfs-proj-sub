#!/bin/bash
# デプロイメインスクリプト

# 引数チェック
if [ "$#" -ne 1 ]; then
    echo "Usage: $0 <environment>"
    echo "  environment: dev, staging, or prod"
    exit 1
fi

# 環境設定
ENV=$1

# スクリプトのディレクトリを取得
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"

# 実行権限を付与
chmod +x ${SCRIPT_DIR}/deploy-dev.sh
chmod +x ${SCRIPT_DIR}/deploy-staging.sh
chmod +x ${SCRIPT_DIR}/deploy-prod.sh
chmod +x ${SCRIPT_DIR}/setup-scheduler.sh

# 環境に応じたデプロイスクリプトを実行
case $ENV in
    dev)
        echo "Deploying to development environment..."
        ${SCRIPT_DIR}/deploy-dev.sh
        ;;
    staging)
        echo "Deploying to staging environment..."
        ${SCRIPT_DIR}/deploy-staging.sh
        ;;
    prod)
        echo "Deploying to production environment..."
        ${SCRIPT_DIR}/deploy-prod.sh
        ;;
    *)
        echo "Invalid environment: $ENV"
        echo "Valid environments: dev, staging, or prod"
        exit 1
        ;;
esac

# デプロイが成功したら、Cloud Schedulerを設定
if [ $? -eq 0 ]; then
    echo "Deployment successful. Setting up Cloud Scheduler..."
    ${SCRIPT_DIR}/setup-scheduler.sh $ENV
else
    echo "Deployment failed. Skipping Cloud Scheduler setup."
    exit 1
fi

echo "Deployment and scheduler setup completed for ${ENV} environment."