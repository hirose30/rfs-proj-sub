# 既存のCloud Runサービスの認証設定とサービスアカウントを更新するスクリプト

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

# サービスアカウントの設定
$SchedulerServiceAccount = "imp-log-etl-scheduler@${ProjectId}.iam.gserviceaccount.com"
$RuntimeServiceAccount = "${RuntimeSAName}@${ProjectId}.iam.gserviceaccount.com"

# 実行用サービスアカウントが存在するか確認
$AccountExists = $false
try {
    $AccountInfo = gcloud iam service-accounts describe ${RuntimeServiceAccount} --project=${ProjectId} 2>$null
    if ($AccountInfo) {
        $AccountExists = $true
        Write-Host "Runtime service account exists: ${RuntimeServiceAccount}"
    }
}
catch {
    Write-Host "Runtime service account does not exist. Please run Setup-Runtime-Account.ps1 first."
    Write-Host "Example: powershell -ExecutionPolicy Bypass -File scripts/deploy-ps/Setup-Runtime-Account.ps1 -Environment ${Environment}"
    exit 1
}

# 認証設定とサービスアカウントの更新
Write-Host "Updating authentication settings and service account for ${ServiceName}..."
gcloud run services update ${ServiceName} `
  --region=${Region} `
  --service-account=${RuntimeServiceAccount} `
  --project=${ProjectId}

# 認証設定の更新（別コマンドで実行）
Write-Host "Updating authentication settings to require authentication..."
gcloud run services set-iam-policy ${ServiceName} `
  policy.yaml `
  --region=${Region} `
  --project=${ProjectId}

# policy.yamlファイルを一時的に作成
$PolicyYaml = @"
bindings:
- members:
  - serviceAccount:${SchedulerServiceAccount}
  - serviceAccount:imp-log-etl-admin@${ProjectId}.iam.gserviceaccount.com
  role: roles/run.invoker
"@

# 一時ファイルに書き込み
$PolicyYaml | Out-File -FilePath "policy.yaml" -Encoding utf8

# 認証設定の更新
try {
    gcloud run services set-iam-policy ${ServiceName} `
      policy.yaml `
      --region=${Region} `
      --project=${ProjectId}
}
catch {
    Write-Host "Error setting IAM policy: $_"
}
finally {
    # 一時ファイルを削除
    if (Test-Path "policy.yaml") {
        Remove-Item "policy.yaml"
    }
}

# スケジューラーサービスアカウントにCloud Run呼び出し権限を付与
Write-Host "Granting invoker role to scheduler service account..."
gcloud run services add-iam-policy-binding ${ServiceName} `
  --member="serviceAccount:${SchedulerServiceAccount}" `
  --role="roles/run.invoker" `
  --region=${Region} `
  --project=${ProjectId}

Write-Host "Authentication settings and service account updated for ${ServiceName}."
Write-Host "Runtime service account: ${RuntimeServiceAccount}"
Write-Host "Scheduler service account: ${SchedulerServiceAccount}"