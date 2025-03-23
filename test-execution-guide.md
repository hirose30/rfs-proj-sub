# BigQueryデータ集約システム テスト実行ガイド

このガイドでは、imp-log-etlサービスのテスト環境設定と実行方法について説明します。

## 前提条件

1. Node.jsとnpmがインストールされていること
2. Google Cloud SDKがインストールされていること
3. BigQueryへのアクセス権限を持つGoogleアカウントがあること

## 環境設定手順

### 1. 認証設定

まず、適切なGoogleアカウントで認証を行います：

```bash
# Googleアカウントでログイン
gcloud auth login your-email@example.com

# Application Default Credentialsを設定
gcloud auth application-default login
```

### 2. プロジェクト設定

使用するGCPプロジェクトを設定します：

```bash
# プロジェクトの設定
gcloud config set project rfs-proj
```

### 3. 依存パッケージのインストール

プロジェクトディレクトリで依存パッケージをインストールします：

```bash
# プロジェクトディレクトリに移動
cd services/cloud-run/imp-log-etl

# 依存パッケージのインストール
npm install
```

## テスト実行方法

### ユニットテスト実行

ユニットテストは実際のBigQueryに接続せず、モックを使用して実行されます：

```bash
# 開発環境設定でユニットテストを実行
$env:NODE_ENV = "development"; npx jest --testPathIgnorePatterns=integration

# または
NODE_ENV=development npm run test:unit
```

### 統合テスト実行

統合テストは実際のBigQueryに接続して実行されます。以下の環境変数を設定する必要があります：

```bash
# Windows PowerShellの場合
$env:NODE_ENV = "development"
$env:RUN_INTEGRATION_TESTS = "true"
$env:TEST_PROJECT_ID = "rfs-proj"
$env:TEST_DATASET = "sg_reports_tmp"
$env:TEST_TABLE = "signage_impressions"
npx jest --testPathPattern=integration

# Bashの場合
NODE_ENV=development RUN_INTEGRATION_TESTS=true TEST_PROJECT_ID=rfs-proj TEST_DATASET=sg_reports_tmp TEST_TABLE=signage_impressions npx jest --testPathPattern=integration
```

### すべてのテスト実行

すべてのテスト（ユニットテストと統合テスト）を実行する場合：

```bash
# Windows PowerShellの場合
$env:NODE_ENV = "development"
$env:RUN_INTEGRATION_TESTS = "true"
$env:TEST_PROJECT_ID = "rfs-proj"
$env:TEST_DATASET = "sg_reports_tmp"
$env:TEST_TABLE = "signage_impressions"
npx jest

# Bashの場合
NODE_ENV=development RUN_INTEGRATION_TESTS=true TEST_PROJECT_ID=rfs-proj TEST_DATASET=sg_reports_tmp TEST_TABLE=signage_impressions npx jest
```

## 注意事項

1. **認証情報**: 適切な権限を持つアカウントで認証を行ってください。特に、`sg_reports_tmp`データセットへの読み書き権限が必要です。

2. **ストリーミングバッファの制限**: BigQueryのストリーミング挿入には制限があり、挿入直後のデータに対してDELETEステートメントを実行できません。テストコードではこの制限を回避するために、テーブルを再作成する方法を使用しています。

3. **テスト失敗時の対応**: 
   - 認証エラーが発生した場合は、`gcloud auth login`と`gcloud auth application-default login`を再実行してください。
   - テーブルアクセスエラーが発生した場合は、データセットとテーブルの権限を確認してください。

4. **テスト結果の解釈**:
   - 統合テストが成功した場合、BigQueryとの連携が正しく機能していることを示しています。
   - ユニットテストの一部が失敗する場合がありますが、これはモックの設定と実際のコードの不一致によるものです。

## トラブルシューティング

### BigQueryアクセス権限の確認

BigQueryへのアクセス権限を確認するには、以下のスクリプトを実行してください：

```bash
# test-bigquery-access.jsを実行
node test-bigquery-access.js
```

このスクリプトは、BigQueryへの接続、データセットの一覧取得、テーブルの作成と削除を試みます。すべての操作が成功すれば、適切な権限が設定されています。

### 認証情報のリセット

認証に問題がある場合は、以下のコマンドで認証情報をリセットしてください：

```bash
# 特定のアカウントの認証情報をリセット
gcloud auth revoke your-email@example.com

# Application Default Credentialsをリセット
gcloud auth application-default revoke

# 再認証
gcloud auth login your-email@example.com
gcloud auth application-default login