# CLAUDE.md

このファイルはClaude Code (claude.ai/code) がこのリポジトリで作業する際のガイダンスを提供します。

## プロジェクト概要

RFS Project Sub-services Repository - Google Cloud Platform上で動作する各種マイクロサービスとユーティリティを管理するリポジトリです。

## リポジトリ構造

```
rfs-proj-sub/
├── services/
│   └── cloud-run/
│       └── imp-log-etl/        # インプレッションログETLサービス
└── credentials/                 # ローカル認証情報（git-ignored）
```

## サービス一覧

### 1. imp-log-etl (Impression Log ETL Service)

デジタルサイネージ広告のインプレッションログを処理するBigQuery ETLマイクロサービス。`services/cloud-run/imp-log-etl/` に配置され、Google Cloud Run上で動作します。

#### 技術スタック

- **ランタイム**: Node.js 18+ with TypeScript
- **フレームワーク**: Express.js
- **クラウドプラットフォーム**: Google Cloud Platform (BigQuery, Cloud Run, Cloud Scheduler)
- **テスト**: Jest with ts-jest
- **ビルド**: TypeScript compiler (tsc)

## 共通設定

- **GCPプロジェクト**: `rfs-proj`
- **リージョン**: `asia-northeast1` (東京)
- **タイムゾーン**: Asia/Tokyo (JST)

## よく使うコマンド

### imp-log-etl サービス

#### 開発
```bash
cd services/cloud-run/imp-log-etl

# 依存関係のインストール
npm install

# ローカル実行（開発モード）
npm run dev

# TypeScriptビルド
npm run build

# 本番サーバー起動
npm start
```

#### テスト
```bash
# 全テスト実行
npm test

# ユニットテストのみ（BigQuery接続なし）
npm run test:unit

# 統合テスト（BigQueryアクセスが必要）
NODE_ENV=development RUN_INTEGRATION_TESTS=true TEST_PROJECT_ID=rfs-proj TEST_DATASET=sg_reports_tmp TEST_TABLE=signage_impressions npm run test:integration

# カバレッジ付きテスト
npm run test:coverage

# 開発用ウォッチモード
npm run test:watch

# 特定のテストファイル実行
npx jest path/to/test.test.ts
```

#### リンティング
```bash
npm run lint
```

#### デプロイ
```bash
# 開発環境へデプロイ
npm run deploy:dev

# ステージング環境へデプロイ
npm run deploy:staging

# 本番環境へデプロイ
npm run deploy:prod

# Windows PowerShellでのデプロイ
npm run deploy:dev:ps
npm run deploy:staging:ps
npm run deploy:prod:ps
```

## サービス詳細

### imp-log-etl アーキテクチャ

#### サービス構造
ETLサービスはレイヤードアーキテクチャに従います：

1. **コントローラー** (`src/controller/`): HTTPリクエストハンドラー
   - `EtlController`: 日次ETL処理エンドポイント
   - `ReprocessController`: 手動再処理エンドポイント

2. **サービス** (`src/service/`): ビジネスロジック
   - `EtlService`: コアETL処理ロジック

3. **リポジトリ** (`src/repository/`): データアクセス層
   - `BigQueryRepository`: BigQueryクライアントラッパー

4. **クエリビルダー** (`src/query/`): SQL生成
   - `ImpQueryBuilder`: インプレッション集計クエリ構築

5. **ユーティリティ** (`src/util/`): 共有ユーティリティ
   - `DateUtil`: JSTタイムゾーン処理
   - `Logger`: Cloud Logging統合付きWinstonベースロギング

#### データフロー
1. Cloud SchedulerがJST 0:15に毎日 `/run` エンドポイントをトリガー
2. コントローラーがリクエストを受信しパラメータを検証
3. サービスがETLプロセスを調整：
   - 対象日付を計算（JST前日）
   - インプレッション集計用SQLクエリを構築
   - BigQueryでクエリを実行
   - 結果を `signage_impressions` テーブルに書き込み
4. 結果は日付でパーティション化され、主要ディメンションでクラスタリング

#### 環境設定
- **開発環境**: `sg_reports_tmp` データセット
- **ステージング環境**: `sg_reports_staging` データセット
- **本番環境**: `sg_reports_production` データセット

環境は `NODE_ENV` 変数で決定され、`src/config/environments.ts` で設定されます。

#### APIエンドポイント
- `GET /run?date=YYYY-MM-DD` - 特定日付を処理（デフォルトは昨日）
- `GET /run-range?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD` - 日付範囲を処理
- `POST /reprocess` - 再処理、ボディ: `{ "date": "YYYY-MM-DD" }`
- `GET /health` - ヘルスチェック

#### セキュリティモデル
最小権限アクセスを持つ3つのサービスアカウント：
- **ランタイム**: `imp-log-etl-runtime@` - BigQueryデータアクセス
- **スケジューラー**: `imp-log-etl-scheduler@` - Cloud Run呼び出し
- **管理者**: `imp-log-etl-admin@` - 手動実行

#### BigQueryテーブル

##### ソーステーブル
- **`rfs_events.requests`** - 生インプレッションログ
  - URLパラメータからデータを抽出（`rfs_events.url_parse()`関数使用）
  - フィルタ条件: `event='complete'`, `networkId='1'`, `send_ts IS NOT NULL`

- **`sg_reports_tmp.signage_imported_temp`** - サイネージデバイス情報
  - 店舗営業時間情報（opening_time, closing_time）を提供
  - device_idで結合

##### ターゲットテーブル: `{dataset}.signage_impressions`

```sql
CREATE TABLE IF NOT EXISTS signage_impressions (
  timestamp_hourly TIMESTAMP,  -- 時間単位の集計タイムスタンプ
  mediumId INT64,              -- メディアID
  storeId INT64,               -- ストアID  
  device_id STRING,            -- デバイスID
  programId INT64,             -- プログラムID
  sequence INT64,              -- シーケンス
  creativeId INT64,            -- クリエイティブID
  deliveryId INT64,            -- デリバリーID
  imp INT64,                   -- インプレッション数
  cnt INT64                    -- カウント数
)
PARTITION BY DATE(timestamp_hourly)
CLUSTER BY mediumId, storeId, creativeId
```

- **パーティション**: 日付単位（timestamp_hourly）
- **クラスタリング**: mediumId, storeId, creativeId
- **データ保持**: 無期限（削除なし）

#### テスト戦略

テストはコンポーネントタイプで整理：
- `test/controller/` - モックサービスによるHTTPエンドポイントテスト
- `test/service/` - モックリポジトリによるビジネスロジックテスト
- `test/query/` - SQLクエリ生成検証
- `test/repository/` - データアクセス層テスト
- `test/integration/` - 実BigQuery統合テスト
- `test/helpers/` - 共有テストユーティリティとモック

カバレッジ閾値: ブランチ70%、関数/行/ステートメント80%

## 共通の考慮事項

1. **タイムゾーン処理**: すべての日付計算はJST（Asia/Tokyo）タイムゾーンを使用
2. **店舗営業時間**: インプレッションは店舗営業時間（10:00-22:00）でフィルタリング
3. **パーティショニング**: 出力テーブルはクエリ効率のため日次パーティショニングを使用
4. **エラー処理**: Cloud Logging統合による包括的なエラーロギング
5. **グレースフルシャットダウン**: Cloud Run用の適切なSIGTERM/SIGINT処理