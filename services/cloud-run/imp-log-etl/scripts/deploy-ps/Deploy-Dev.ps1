# 開発環境へのデプロイスクリプト

# 変数設定
$ProjectId = "rfs-proj"
$ServiceName = "imp-log-etl-dev"
$Region = "asia-northeast1"
$ImageName = "imp-log-etl:latest"
$ArHostname = "asia-northeast1-docker.pkg.dev"
$RepoName = "imp-log-etl-repo"
$ArImage = "${ArHostname}/${ProjectId}/${RepoName}/${ServiceName}:latest"

# Artifact Registryリポジトリが存在するか確認し、なければ作成
Write-Host "Checking if Artifact Registry repository exists..."
$RepoExists = gcloud artifacts repositories list --project=${ProjectId} --location=${Region} --filter="name:${RepoName}" --format="value(name)"
if (-not $RepoExists) {
    Write-Host "Creating Artifact Registry repository..."
    gcloud artifacts repositories create ${RepoName} `
        --repository-format=docker `
        --location=${Region} `
        --description="Repository for imp-log-etl service" `
        --project=${ProjectId}
}

# Docker認証ヘルパーを設定
Write-Host "Configuring Docker authentication helper for Artifact Registry..."
gcloud auth configure-docker ${ArHostname} --quiet

# イメージにタグ付け
Write-Host "Tagging image for development environment..."
docker tag ${ImageName} ${ArImage}

# Artifact Registryにプッシュ
Write-Host "Pushing image to Artifact Registry..."
docker push ${ArImage}

# 実行用サービスアカウントの設定
$RuntimeSAName = "imp-log-etl-runtime"
$RuntimeServiceAccount = "${RuntimeSAName}@${ProjectId}.iam.gserviceaccount.com"

# サービスアカウントが存在するか確認
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
    Write-Host "Example: powershell -ExecutionPolicy Bypass -File scripts/deploy-ps/Setup-Runtime-Account.ps1 -Environment dev"
    exit 1
}

# Cloud Runにデプロイ
Write-Host "Deploying to Cloud Run (development environment)..."
gcloud run deploy ${ServiceName} `
  --image ${ArImage} `
  --platform managed `
  --region ${Region} `
  --no-allow-unauthenticated `
  --service-account ${RuntimeServiceAccount} `
  --memory 1024Mi `
  --cpu 1 `
  --concurrency 80 `
  --timeout 300 `
  --set-env-vars "NODE_ENV=development" `
  --project ${ProjectId}

# サービスアカウントの設定
$ServiceAccount = "imp-log-etl-scheduler@${ProjectId}.iam.gserviceaccount.com"

# サービスアカウントにCloud Run呼び出し権限を付与
Write-Host "Granting invoker role to service account..."
gcloud run services add-iam-policy-binding ${ServiceName} `
  --member="serviceAccount:${ServiceAccount}" `
  --role="roles/run.invoker" `
  --region=${Region} `
  --project=${ProjectId}

Write-Host "Deployment to development environment completed."