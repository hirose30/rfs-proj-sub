# Cloud Schedulerの設定スクリプト

param (
    [Parameter(Mandatory=$true)]
    [ValidateSet("dev", "staging", "prod")]
    [string]$Environment
)

# 環境設定
$ProjectId = "rfs-proj"
$Region = "asia-northeast1"

# 環境に応じた設定
switch ($Environment) {
    "dev" {
        $ServiceName = "imp-log-etl-dev"
        $JobName = "imp-log-etl-daily-dev"
    }
    "staging" {
        $ServiceName = "imp-log-etl-staging"
        $JobName = "imp-log-etl-daily-staging"
    }
    "prod" {
        $ServiceName = "imp-log-etl-prod"
        $JobName = "imp-log-etl-daily-prod"
    }
}

# サービスURLの取得
Write-Host "Getting service URL for $ServiceName..."
$ServiceUrl = gcloud run services describe $ServiceName `
    --platform managed `
    --region $Region `
    --project $ProjectId `
    --format="value(status.url)"

if ([string]::IsNullOrEmpty($ServiceUrl)) {
    Write-Error "Error: Could not retrieve service URL for $ServiceName"
    exit 1
}

# サービスアカウントの設定
$ServiceAccount = "imp-log-etl-scheduler@${ProjectId}.iam.gserviceaccount.com"

# Cloud Schedulerジョブの作成
Write-Host "Creating Cloud Scheduler job for $Environment environment..."
gcloud scheduler jobs create http $JobName `
    --location=$Region `
    --schedule="15 0 * * *" `
    --time-zone="Asia/Tokyo" `
    --uri="${ServiceUrl}/run" `
    --http-method=GET `
    --oidc-service-account-email=$ServiceAccount `
    --oidc-token-audience="${ServiceUrl}" `
    --project $ProjectId

Write-Host "Cloud Scheduler job for $Environment environment created successfully."