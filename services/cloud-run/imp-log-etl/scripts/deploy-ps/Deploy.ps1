# デプロイメインスクリプト

param (
    [Parameter(Mandatory=$true)]
    [ValidateSet("dev", "staging", "prod")]
    [string]$Environment
)

# スクリプトのディレクトリを取得
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# 環境に応じたデプロイスクリプトを実行
Write-Host "Deploying to $Environment environment..."

switch ($Environment) {
    "dev" {
        & "$ScriptDir\Deploy-Dev.ps1"
    }
    "staging" {
        & "$ScriptDir\Deploy-Staging.ps1"
    }
    "prod" {
        & "$ScriptDir\Deploy-Prod.ps1"
    }
}

# デプロイが成功したら、Cloud Schedulerを設定
if ($LASTEXITCODE -eq 0) {
    Write-Host "Deployment successful. Setting up Cloud Scheduler..."
    & "$ScriptDir\Setup-Scheduler.ps1" -Environment $Environment
}
else {
    Write-Error "Deployment failed. Skipping Cloud Scheduler setup."
    exit 1
}

Write-Host "Deployment and scheduler setup completed for $Environment environment."