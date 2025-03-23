# デプロイメントガイド

このドキュメントでは、imp-log-etlサービスのデプロイプロセスについて説明します。

## 前提条件

- Google Cloud SDKがインストールされていること
- Dockerがインストールされていること
- 適切なGCPプロジェクト権限があること

## 環境設定

このサービスは以下の3つの環境に対応しています：

1. **開発環境（Development）**
   - データセット: `sg_reports_tmp`
   - サービス名: `imp-log-etl-dev`

2. **ステージング環境（Staging）**
   - データセット: `sg_reports_staging`
   - サービス名: `imp-log-etl-staging`

3. **本番環境（Production）**
   - データセット: `sg_reports_production`
   - サービス名: `imp-log-etl-prod`

環境は`NODE_ENV`環境変数によって切り替わります。デプロイスクリプトは自動的に適切な環境変数を設定します。

## デプロイ手順

### 1. Dockerイメージのビルド

```bash
npm run docker:build
```

このコマンドは、ローカルでDockerイメージをビルドします。

### 2. 環境へのデプロイ

#### Linux/macOS環境での実行

##### 開発環境へのデプロイ

```bash
npm run deploy:dev
```

##### ステージング環境へのデプロイ

```bash
npm run deploy:staging
```

##### 本番環境へのデプロイ

```bash
npm run deploy:prod
```

#### Windows環境での実行

##### 開発環境へのデプロイ

```powershell
npm run deploy:dev:ps
```

##### ステージング環境へのデプロイ

```powershell
npm run deploy:staging:ps
```

##### 本番環境へのデプロイ

```powershell
npm run deploy:prod:ps
```

各デプロイコマンドは以下の処理を行います：

1. Dockerイメージにタグ付け
2. Google Container Registry（GCR）へのイメージプッシュ
3. Cloud Runへのデプロイ
4. Cloud Schedulerの設定

## Cloud Schedulerの設定

Cloud Schedulerは、毎日JST 0:15に自動的にETL処理を実行するように設定されています。スケジューラーの設定は各環境ごとに行われます。

スケジューラーの設定のみを行う場合は、以下のコマンドを実行します：

```bash
bash scripts/deploy/setup-scheduler.sh <environment>
```

`<environment>`には、`dev`、`staging`、または`prod`を指定します。

## 手動実行

デプロイ後、以下のエンドポイントを使用して手動でETL処理を実行できます：

- 標準実行: `GET /run`
  - 例: `https://imp-log-etl-dev-xxxxx.run.app/run`
  - オプションで日付パラメータを指定可能: `?date=2025-03-22`

- 再処理: `POST /reprocess`
  - 例: `https://imp-log-etl-dev-xxxxx.run.app/reprocess`
  - リクエストボディ: `{ "date": "2025-03-22" }`

## トラブルシューティング

### デプロイに失敗する場合

1. Google Cloud SDKが正しく認証されていることを確認
   ```bash
   gcloud auth login
   ```

2. プロジェクトが正しく設定されていることを確認
   ```bash
   gcloud config set project rfs-proj
   ```

3. 必要なAPIが有効になっていることを確認
   - Cloud Run API
   - Container Registry API
   - Cloud Scheduler API

### Cloud Schedulerの設定に失敗する場合

1. サービスアカウントが存在することを確認
   ```bash
   gcloud iam service-accounts describe imp-log-etl-scheduler@rfs-proj.iam.gserviceaccount.com
   ```

2. サービスアカウントに適切な権限があることを確認
   ```bash
   gcloud projects add-iam-policy-binding rfs-proj \
     --member="serviceAccount:imp-log-etl-scheduler@rfs-proj.iam.gserviceaccount.com" \
     --role="roles/run.invoker"