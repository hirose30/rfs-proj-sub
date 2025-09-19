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
    Write-Host "Example: powershell -ExecutionPolicy Bypass -File scripts/deploy-ps/Setup-Runtime-Account.ps1 -Environment prod"
    exit 1
}

# Cloud Runにデプロイ
Write-Host "Deploying to Cloud Run (production environment)..."
gcloud run deploy ${ServiceName} `
  --image ${GcrImage} `
  --platform managed `
  --region ${Region} `
  --no-allow-unauthenticated `
  --service-account ${RuntimeServiceAccount} `
  --memory 1Gi `
  --cpu 2 `
  --concurrency 80 `
  --timeout 300 `
  --set-env-vars "NODE_ENV=production" `
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

Write-Host "Deployment to production environment completed."