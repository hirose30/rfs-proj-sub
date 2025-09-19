# サービスアカウントキーを作成するスクリプト

# 引数チェック
param (
    [Parameter(Mandatory=$true)]
    [ValidateSet("dev", "staging", "prod")]
    [string]$Environment
)

# 環境設定
$ProjectId = "rfs-proj"
$Region = "asia-northeast1"
$RuntimeSAName = "imp-log-etl-runtime"
$RuntimeServiceAccount = "${RuntimeSAName}@${ProjectId}.iam.gserviceaccount.com"

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

# キーファイル名
$KeyFileName = "imp-log-etl-runtime-key.json"

# サービスアカウントキーの作成
Write-Host "Creating service account key for ${RuntimeServiceAccount}..."
gcloud iam service-accounts keys create ${KeyFileName} `
    --iam-account=${RuntimeServiceAccount} `
    --project=${ProjectId}

# キーファイルの内容を取得
$KeyContent = Get-Content -Path ${KeyFileName} -Raw

# Base64エンコード
$KeyContentBase64 = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($KeyContent))

# Cloud Runサービスの更新（環境変数の設定）
Write-Host "Updating Cloud Run service with service account key..."
gcloud run services update ${ServiceName} `
    --region=${Region} `
    --project=${ProjectId} `
    --set-env-vars="GOOGLE_APPLICATION_CREDENTIALS=/tmp/key.json,GOOGLE_APPLICATION_CREDENTIALS_CONTENT=${KeyContentBase64}"

Write-Host "Service account key created and set as environment variable for ${ServiceName}."
Write-Host "IMPORTANT: The key file ${KeyFileName} has been created in the current directory."
Write-Host "Please secure this file or delete it after use."

# 注意事項
Write-Host ""
Write-Host "NOTE: The service now uses a service account key stored as an environment variable."
Write-Host "This approach works but is not the most secure method for production environments."
Write-Host "For production, consider using Workload Identity Federation as mentioned in the implementation plan."