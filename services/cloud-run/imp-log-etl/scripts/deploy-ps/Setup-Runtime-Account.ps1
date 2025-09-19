# Cloud Run実行用サービスアカウントの設定スクリプト

# 引数チェック
param (
    [Parameter(Mandatory=$true)]
    [ValidateSet("dev", "staging", "prod")]
    [string]$Environment
)

# 環境設定
$ProjectId = "rfs-proj"
$Region = "asia-northeast1"

# すべての環境で共通のサービスアカウント名を使用
$RuntimeSAName = "imp-log-etl-runtime"

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

# 実行用サービスアカウントの完全な名前
$RuntimeServiceAccount = "${RuntimeSAName}@${ProjectId}.iam.gserviceaccount.com"

# サービスアカウントが存在するか確認
$AccountExists = $false
try {
    $AccountInfo = gcloud iam service-accounts describe ${RuntimeServiceAccount} --project=${ProjectId} 2>$null
    if ($AccountInfo) {
        $AccountExists = $true
        Write-Host "Runtime service account already exists: ${RuntimeServiceAccount}"
    }
}
catch {
    Write-Host "Runtime service account does not exist. Will create it."
    $AccountExists = $false
}

# サービスアカウントが存在しない場合は作成
if (-not $AccountExists) {
    # 実行用サービスアカウントの作成
    Write-Host "Creating runtime service account..."
    gcloud iam service-accounts create ${RuntimeSAName} `
        --display-name="Imp Log ETL Runtime Service Account for ${Environment}" `
        --project=${ProjectId}
    
    # 作成後に少し待機（GCPでの反映を待つ）
    Write-Host "Waiting for service account to be fully provisioned..."
    Start-Sleep -Seconds 10
}

# BigQuery権限を付与
Write-Host "Granting BigQuery permissions to runtime service account..."
gcloud projects add-iam-policy-binding ${ProjectId} `
  --member="serviceAccount:${RuntimeServiceAccount}" `
  --role="roles/bigquery.user"

gcloud projects add-iam-policy-binding ${ProjectId} `
  --member="serviceAccount:${RuntimeServiceAccount}" `
  --role="roles/bigquery.dataViewer"

gcloud projects add-iam-policy-binding ${ProjectId} `
  --member="serviceAccount:${RuntimeServiceAccount}" `
  --role="roles/bigquery.dataEditor"

# Google Driveアクセス権限
# 注意: プロジェクトレベルではGoogle Drive権限を付与できません
# 必要に応じて、特定のGoogle Driveリソースに対して権限を付与するか、
# Workload Identity Federationを設定してください
Write-Host "Note: Google Drive permissions need to be configured separately."
Write-Host "See implementation plan for options like Workload Identity Federation."

# 以下のコマンドはプロジェクトレベルでは動作しません
# gcloud projects add-iam-policy-binding ${ProjectId} `
#   --member="serviceAccount:${RuntimeServiceAccount}" `
#   --role="roles/drive.readonly"

Write-Host "Runtime service account setup completed for ${Environment} environment: ${RuntimeServiceAccount}"
Write-Host ""
Write-Host "To update the Cloud Run service to use this service account, run:"
Write-Host "gcloud run services update ${ServiceName} --service-account=${RuntimeServiceAccount} --region=${Region} --project=${ProjectId}"