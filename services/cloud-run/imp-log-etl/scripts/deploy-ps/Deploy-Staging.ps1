# ステージング環境へのデプロイスクリプト

# 変数設定
$ProjectId = "rfs-proj"
$ServiceName = "imp-log-etl-staging"
$Region = "asia-northeast1"
$ImageName = "imp-log-etl:latest"
$GcrHostname = "gcr.io"
$GcrImage = "${GcrHostname}/${ProjectId}/${ServiceName}"

# イメージにタグ付け
Write-Host "Tagging image for staging environment..."
docker tag ${ImageName} ${GcrImage}

# GCRにプッシュ
Write-Host "Pushing image to Google Container Registry..."
docker push ${GcrImage}

# Cloud Runにデプロイ
Write-Host "Deploying to Cloud Run (staging environment)..."
gcloud run deploy ${ServiceName} `
  --image ${GcrImage} `
  --platform managed `
  --region ${Region} `
  --allow-unauthenticated `
  --memory 512Mi `
  --cpu 1 `
  --concurrency 80 `
  --timeout 300 `
  --set-env-vars "NODE_ENV=staging" `
  --project ${ProjectId}

Write-Host "Deployment to staging environment completed."