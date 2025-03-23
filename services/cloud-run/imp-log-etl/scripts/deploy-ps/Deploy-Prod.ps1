# 本番環境へのデプロイスクリプト

# 変数設定
$ProjectId = "rfs-proj"
$ServiceName = "imp-log-etl-prod"
$Region = "asia-northeast1"
$ImageName = "imp-log-etl:latest"
$GcrHostname = "gcr.io"
$GcrImage = "${GcrHostname}/${ProjectId}/${ServiceName}"

# イメージにタグ付け
Write-Host "Tagging image for production environment..."
docker tag ${ImageName} ${GcrImage}

# GCRにプッシュ
Write-Host "Pushing image to Google Container Registry..."
docker push ${GcrImage}

# Cloud Runにデプロイ
Write-Host "Deploying to Cloud Run (production environment)..."
gcloud run deploy ${ServiceName} `
  --image ${GcrImage} `
  --platform managed `
  --region ${Region} `
  --allow-unauthenticated `
  --memory 1Gi `
  --cpu 2 `
  --concurrency 80 `
  --timeout 300 `
  --set-env-vars "NODE_ENV=production" `
  --project ${ProjectId}

Write-Host "Deployment to production environment completed."