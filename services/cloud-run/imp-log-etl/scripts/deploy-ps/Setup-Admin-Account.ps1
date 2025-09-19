# 管理者用サービスアカウントの設定スクリプト

# 引数チェック
param (
    [Parameter(Mandatory=$true)]
    [ValidateSet("dev", "staging", "prod")]
    [string]$Environment,
    
    [Parameter(Mandatory=$false)]
    [switch]$CreateKey
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

# 管理者用サービスアカウントの名前
$AdminServiceAccount = "imp-log-etl-admin@${ProjectId}.iam.gserviceaccount.com"

# サービスアカウントが存在するか確認
$AccountExists = $false
try {
    $AccountInfo = gcloud iam service-accounts describe ${AdminServiceAccount} --project=${ProjectId} 2>$null
    if ($AccountInfo) {
        $AccountExists = $true
        Write-Host "Admin service account already exists: ${AdminServiceAccount}"
    }
}
catch {
    Write-Host "Admin service account does not exist. Will create it."
    $AccountExists = $false
}

# サービスアカウントが存在しない場合は作成
if (-not $AccountExists) {
    # 管理者用サービスアカウントの作成
    Write-Host "Creating admin service account..."
    gcloud iam service-accounts create imp-log-etl-admin `
        --display-name="Imp Log ETL Admin Service Account" `
        --project=${ProjectId}
    
    # 作成後に少し待機（GCPでの反映を待つ）
    Write-Host "Waiting for service account to be fully provisioned..."
    Start-Sleep -Seconds 10
}

# サービスアカウントにCloud Run呼び出し権限を付与
Write-Host "Granting invoker role to admin service account..."
gcloud run services add-iam-policy-binding ${ServiceName} `
  --member="serviceAccount:${AdminServiceAccount}" `
  --role="roles/run.invoker" `
  --region=${Region} `
  --project=${ProjectId}

# サービスアカウントキーの作成（オプション）
# 注意: サービスアカウントキーの作成は必要な場合のみ行ってください
# セキュリティ上のベストプラクティスとして、可能な限りキーの使用は避けることをお勧めします
if ($CreateKey) {
    Write-Host "Creating service account key..."
    $KeyFile = "imp-log-etl-admin-key-${Environment}.json"
    gcloud iam service-accounts keys create ${KeyFile} `
        --iam-account=${AdminServiceAccount} `
        --project=${ProjectId}
    Write-Host "Service account key created: ${KeyFile}"
    Write-Host "IMPORTANT: Keep this key secure and do not commit it to version control!"
}
else {
    Write-Host "Service account key not created. Use -CreateKey switch to create a key if needed."
}

Write-Host "Admin service account setup completed for ${Environment} environment."
Write-Host ""
Write-Host "To use this service account for manual operations, you can:"
Write-Host "1. Use gcloud auth as the service account (recommended):"
Write-Host "   gcloud auth activate-service-account ${AdminServiceAccount} --key-file=PATH_TO_KEY_FILE"
Write-Host ""
Write-Host "2. Use curl with an ID token:"
Write-Host "   `$Token = gcloud auth print-identity-token --impersonate-service-account=${AdminServiceAccount}"
Write-Host "   Invoke-RestMethod -Uri https://${ServiceName}-xxxxx.run.app/run -Headers @{Authorization = 'Bearer ' + `$Token}"
Write-Host ""
Write-Host "3. For reprocessing, use:"
Write-Host "   Invoke-RestMethod -Method Post -Uri https://${ServiceName}-xxxxx.run.app/reprocess -Headers @{Authorization = 'Bearer ' + `$Token; 'Content-Type' = 'application/json'} -Body '{""date"":""YYYY-MM-DD""}'"