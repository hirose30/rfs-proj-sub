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

## セキュリティ設定

### サービスアカウント構成

このサービスは、以下の3種類のサービスアカウントを使用して、最小権限の原則に基づいたセキュリティ設定を実現しています：

1. **実行用サービスアカウント**: `imp-log-etl-runtime@rfs-proj.iam.gserviceaccount.com`
   - すべての環境で共通のサービスアカウント
   - Cloud Runサービス自体が使用するサービスアカウント
   - BigQueryへのアクセス権限（`roles/bigquery.user`, `roles/bigquery.dataViewer`, `roles/bigquery.dataEditor`）
   - Google Driveへの読み取り権限（必要に応じて別途設定）

2. **スケジューラー用サービスアカウント**: `imp-log-etl-scheduler@rfs-proj.iam.gserviceaccount.com`
   - Cloud Schedulerが使用するサービスアカウント
   - `roles/run.invoker` 権限を持ち、Cloud Runサービスを呼び出せます

3. **管理者用サービスアカウント**: `imp-log-etl-admin@rfs-proj.iam.gserviceaccount.com`
   - 管理者が手動でETL処理を実行するためのサービスアカウント
   - `roles/run.invoker` 権限を持ち、Cloud Runサービスを呼び出せます

### 認証設定

Cloud Runサービスは認証が必須に設定されており、認証されたユーザーやサービスアカウントのみがアクセスできます。

### 実行用サービスアカウントの設定

Cloud Runサービスが使用する実行用サービスアカウントを設定するには、以下のスクリプトを実行します：

#### Windows環境での実行

```powershell
powershell -ExecutionPolicy Bypass -File scripts/deploy-ps/Setup-Runtime-Account.ps1 -Environment <environment>
```

`<environment>`には、`dev`、`staging`、または`prod`を指定します。

このスクリプトは、以下の処理を行います：
1. 実行用サービスアカウントの作成（存在しない場合）
2. BigQueryへのアクセス権限の付与

### Google Spreadsheetアクセスの設定

ETLクエリでは`rfs_spreadsheet.signage`テーブルを使用しており、このテーブルはGoogle Spreadsheetと連携しています。このテーブルにアクセスするには、以下の設定が必要です：

1. **Googleスプレッドシートの共有設定**

   データソースとなるGoogleスプレッドシートの共有設定で、Cloud Runサービスが使用するサービスアカウントに閲覧権限を付与します：
   
   - サービスアカウント: `imp-log-etl-runtime@rfs-proj.iam.gserviceaccount.com`
   - 付与する権限: 閲覧者（Viewer）
   
   手順：
   1. Googleスプレッドシートを開く
   2. 右上の「共有」ボタンをクリック
   3. 「ユーザーやグループを追加」欄にサービスアカウントのメールアドレスを入力
   4. 権限を「閲覧者」に設定
   5. 「送信」をクリック

2. **BigQueryの外部テーブル設定の確認**

   BigQueryコンソールで、`rfs_spreadsheet.signage`テーブルの設定を確認し、正しく外部データソースとして設定されていることを確認します。

これらの設定を行うことで、サービスアカウントキーを使用せずに、Cloud Runサービスから安全にGoogleスプレッドシートのデータにアクセスできるようになります。

### 既存のサービスの設定更新

既存のサービスの認証設定とサービスアカウントを更新するには、以下のスクリプトを実行します：

#### Linux/macOS環境での実行

```bash
bash scripts/deploy/update-auth-settings.sh <environment>
```

#### Windows環境での実行

```powershell
# 実行用サービスアカウントを先に設定
powershell -ExecutionPolicy Bypass -File scripts/deploy-ps/Setup-Runtime-Account.ps1 -Environment <environment>

# 認証設定とサービスアカウントを更新
powershell -ExecutionPolicy Bypass -File scripts/deploy-ps/Update-Auth-Settings.ps1 -Environment <environment>
```

`<environment>`には、`dev`、`staging`、または`prod`を指定します。

### 管理者用サービスアカウントの設定

管理者用のサービスアカウントを設定するには、以下のスクリプトを実行します：

#### Linux/macOS環境での実行

```bash
bash scripts/deploy/setup-admin-account.sh <environment>
```

#### Windows環境での実行

```powershell
powershell -ExecutionPolicy Bypass -File scripts/deploy-ps/Setup-Admin-Account.ps1 -Environment <environment>
```

サービスアカウントキーを作成する場合は、以下のオプションを追加します：

#### Linux/macOS環境での実行

```bash
bash scripts/deploy/setup-admin-account.sh <environment> --create-key
```

#### Windows環境での実行

```powershell
powershell -ExecutionPolicy Bypass -File scripts/deploy-ps/Setup-Admin-Account.ps1 -Environment <environment> -CreateKey
```

### 手動実行時の認証

手動でETL処理を実行する場合は、管理者用サービスアカウントを使用して認証する必要があります：

1. サービスアカウントとして認証（推奨）：
   ```bash
   gcloud auth activate-service-account imp-log-etl-admin@rfs-proj.iam.gserviceaccount.com --key-file=PATH_TO_KEY_FILE
   ```

2. IDトークンを使用してcurlで呼び出す：
   ```bash
   TOKEN=$(gcloud auth print-identity-token --impersonate-service-account=imp-log-etl-admin@rfs-proj.iam.gserviceaccount.com)
   curl -H "Authorization: Bearer ${TOKEN}" https://imp-log-etl-dev-xxxxx.run.app/run
   ```

3. 再処理の場合：
   ```bash
   curl -X POST -H "Authorization: Bearer ${TOKEN}" -H "Content-Type: application/json" -d '{"date":"2025-03-22"}' https://imp-log-etl-dev-xxxxx.run.app/reprocess
   ```

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
   ```

### 認証エラーが発生する場合

1. サービスアカウントに適切な権限があることを確認
   ```bash
   gcloud run services get-iam-policy imp-log-etl-dev --region=asia-northeast1 --format=yaml
   ```

2. 必要に応じて権限を追加
   ```bash
   gcloud run services add-iam-policy-binding imp-log-etl-dev \
     --member="serviceAccount:imp-log-etl-admin@rfs-proj.iam.gserviceaccount.com" \
     --role="roles/run.invoker" \
     --region=asia-northeast1
   ```