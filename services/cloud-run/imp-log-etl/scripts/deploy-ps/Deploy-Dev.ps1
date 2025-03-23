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

# Cloud Runにデプロイ
Write-Host "Deploying to Cloud Run (development environment)..."
gcloud run deploy ${ServiceName} `
  --image ${ArImage} `
  --platform managed `
  --region ${Region} `
  --allow-unauthenticated `
  --memory 512Mi `
  --cpu 1 `
  --concurrency 80 `
  --timeout 300 `
  --set-env-vars "NODE_ENV=development" `
  --project ${ProjectId}

Write-Host "Deployment to development environment completed."