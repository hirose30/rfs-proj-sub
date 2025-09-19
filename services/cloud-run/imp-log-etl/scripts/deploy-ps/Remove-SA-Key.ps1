# サービスアカウントキーの環境変数を削除するスクリプト

# 引数チェック
param (
    [Parameter(Mandatory=$true)]
    [ValidateSet("dev", "staging", "prod")]
    [string]$Environment
)

# 環境設定
$ProjectId = "rfs-proj"
$Region = "asia-northeast1"

switch ($Environment) {
    "dev" {
        $ServiceName = "imp-log-etl-dev"
    }
    "staging" {
        $ServiceName = "imp-log-etl-staging"
    }
    "prod" {
        $ServiceName = "imp-log-etl-prod"
    }
    default {
        Write-Error "Invalid environment: $Environment"
        Write-Host "Valid environments: dev, staging, or prod"
        exit 1
    }
}

# Cloud Runサービスの更新（環境変数の削除）
Write-Host "Removing service account key environment variables from Cloud Run service..."
gcloud run services update ${ServiceName} `
    --region=${Region} `
    --project=${ProjectId} `
    --remove-env-vars="GOOGLE_APPLICATION_CREDENTIALS,GOOGLE_APPLICATION_CREDENTIALS_CONTENT"

Write-Host "Service account key environment variables removed from ${ServiceName}."

# キーファイルの削除（存在する場合）
$KeyFileName = "imp-log-etl-runtime-key.json"
if (Test-Path $KeyFileName) {
    Write-Host "Removing service account key file..."
    Remove-Item $KeyFileName
    Write-Host "Service account key file removed."
}