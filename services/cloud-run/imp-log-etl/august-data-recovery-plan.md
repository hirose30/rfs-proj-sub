# signage_impressionsテーブル 8月データリカバリ計画

## 概要
2025年8月のインプレッションデータが欠損しているため、リカバリを実施する。
過去に7月データのリカバリを実施した経験を基に、8月データの復旧を行う。

## 現状分析

### 判明している事項
- 対象テーブル: `signage_impressions`
- 欠損期間: 2025年8月1日〜8月31日
- 対象環境: development（sg_reports_tmp）
- 過去のリカバリ: 7月データのリカバリプランが存在

### ETLサービス構成
- サービス名: `imp-log-etl-dev`（開発環境）
- デプロイ先: Google Cloud Run
- ソーステーブル: `rfs_events.requests`
- 補助テーブル: `sg_reports_tmp.signage_imported_temp`（営業時間情報）
- 処理内容: 時間別インプレッション集計

## 作業計画

### フェーズ1: 現状調査と欠損確認

#### 1.1 データ欠損状況の詳細調査
開発環境のsignage_impressionsテーブルで8月データの有無を確認

```sql
-- 開発環境のデータ確認（7月〜9月の状況確認）
SELECT 
  DATE(timestamp_hourly) as date,
  COUNT(*) as record_count,
  SUM(imp) as total_impressions
FROM `rfs-proj.sg_reports_tmp.signage_impressions`
WHERE DATE(timestamp_hourly) BETWEEN "2025-07-01" AND "2025-09-30"
GROUP BY date
ORDER BY date;
```

#### 1.2 ソースデータの存在確認
`rfs_events.requests`テーブルに8月のrawデータが存在するか確認

```sql
-- 8月のソースデータ件数確認
SELECT 
  DATE(TIMESTAMP_ADD(TIMESTAMP, INTERVAL 9 HOUR)) as jst_date,
  COUNT(*) as total_records,
  COUNTIF(regexp_extract(httpRequest.requestUrl, '//[^/]+([^?#]+)') = '/tracking') as tracking_records,
  COUNTIF(rfs_events.url_parse(httpRequest.requestUrl, 'event') = 'complete') as complete_events,
  COUNTIF(rfs_events.url_parse(httpRequest.requestUrl, 'networkId') = '1') as network_1
FROM `rfs-proj.rfs_events.requests`
WHERE DATE(TIMESTAMP_ADD(TIMESTAMP, INTERVAL 9 HOUR)) BETWEEN "2025-08-01" AND "2025-08-31"
GROUP BY jst_date
ORDER BY jst_date;
```

#### 1.3 関連テーブルの状況確認

```sql
-- signage_imported_tempテーブルの存在確認
SELECT table_name
FROM `rfs-proj.sg_reports_tmp.INFORMATION_SCHEMA.TABLES`
WHERE table_name = 'signage_imported_temp';

-- テーブルが存在する場合、データ件数確認
SELECT COUNT(*) as record_count
FROM `rfs-proj.sg_reports_tmp.signage_imported_temp`;
```

### フェーズ2: リカバリ準備

#### 2.1 前提条件確認
- [ ] Google Cloud Shellアクセス権限
- [ ] `rfs-proj`プロジェクトへのアクセス権限
- [ ] BigQuery編集権限
- [ ] Cloud Run `imp-log-etl-dev`サービスへのinvoker権限

#### 2.2 補助テーブルの準備
signage_imported_tempテーブルが存在しない場合の作成

```bash
# ダミーテーブルを作成（必要な場合のみ）
bq query --use_legacy_sql=false '
CREATE OR REPLACE TABLE `rfs-proj.sg_reports_tmp.signage_imported_temp` (
  fully_device_id STRING,
  opening_time STRING,
  closing_time STRING
)'
```

### フェーズ3: リカバリ実行

#### 3.1 テスト実行（8月1日のみ）
まず1日分のデータで動作確認

```bash
# 認証トークンの取得とテスト実行
curl -X GET \
  -H "Authorization: Bearer $(gcloud auth print-identity-token)" \
  "https://imp-log-etl-dev-548006961857.asia-northeast1.run.app/run?date=2025-08-01"
```

#### 3.2 段階的リカバリ実行
週単位での処理（タイムアウト対策）

```bash
# 第1週（8/1-8/7）
curl -X GET \
  -H "Authorization: Bearer $(gcloud auth print-identity-token)" \
  "https://imp-log-etl-dev-548006961857.asia-northeast1.run.app/run-range?startDate=2025-08-01&endDate=2025-08-07"

# 結果確認後、第2週（8/8-8/14）
curl -X GET \
  -H "Authorization: Bearer $(gcloud auth print-identity-token)" \
  "https://imp-log-etl-dev-548006961857.asia-northeast1.run.app/run-range?startDate=2025-08-08&endDate=2025-08-14"

# 結果確認後、第3週（8/15-8/21）
curl -X GET \
  -H "Authorization: Bearer $(gcloud auth print-identity-token)" \
  "https://imp-log-etl-dev-548006961857.asia-northeast1.run.app/run-range?startDate=2025-08-15&endDate=2025-08-21"

# 結果確認後、第4週以降（8/22-8/31）
curl -X GET \
  -H "Authorization: Bearer $(gcloud auth print-identity-token)" \
  "https://imp-log-etl-dev-548006961857.asia-northeast1.run.app/run-range?startDate=2025-08-22&endDate=2025-08-31"
```

#### 3.3 データ検証
各週の処理後に実行

```sql
-- 8月データの投入状況確認
SELECT 
  DATE(timestamp_hourly) as date,
  COUNT(*) as record_count,
  SUM(imp) as total_impressions,
  MIN(timestamp_hourly) as earliest_record,
  MAX(timestamp_hourly) as latest_record
FROM `rfs-proj.sg_reports_tmp.signage_impressions`
WHERE DATE(timestamp_hourly) BETWEEN "2025-08-01" AND "2025-08-31"
GROUP BY date
ORDER BY date;

-- 時間別の詳細確認（特定日）
SELECT 
  EXTRACT(HOUR FROM timestamp_hourly) as hour,
  COUNT(*) as record_count,
  SUM(imp) as impressions
FROM `rfs-proj.sg_reports_tmp.signage_impressions`
WHERE DATE(timestamp_hourly) = "2025-08-01"
GROUP BY hour
ORDER BY hour;
```

### フェーズ4: 現行ETLプロセスの確認

#### 4.1 最近のETL実行状況確認

```sql
-- 直近1週間のデータ生成状況
SELECT 
  DATE(timestamp_hourly) as date,
  COUNT(*) as record_count,
  SUM(imp) as total_impressions
FROM `rfs-proj.sg_reports_tmp.signage_impressions`
WHERE DATE(timestamp_hourly) >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
GROUP BY date
ORDER BY date DESC;
```

#### 4.2 Cloud Runサービスのログ確認

```bash
# Cloud Runサービスのログ確認（直近のエラー）
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=imp-log-etl-dev AND severity>=ERROR" \
  --limit=20 \
  --format=json \
  --project=rfs-proj

# 特定日のログ確認
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=imp-log-etl-dev AND timestamp>=\"2025-09-01T00:00:00Z\" AND timestamp<=\"2025-09-12T23:59:59Z\"" \
  --limit=50 \
  --format="value(timestamp,jsonPayload.message,severity)" \
  --project=rfs-proj
```

#### 4.3 Cloud Schedulerジョブの確認

```bash
# Schedulerジョブの一覧と状態確認
gcloud scheduler jobs list --location=asia-northeast1 --project=rfs-proj

# 特定ジョブの詳細確認（ジョブ名は要確認）
gcloud scheduler jobs describe [JOB_NAME] --location=asia-northeast1 --project=rfs-proj
```

## 作業チェックリスト

### 事前準備
- [ ] Google Cloud Shellへログイン
- [ ] プロジェクト`rfs-proj`を選択
- [ ] 必要な権限の確認

### データ調査
- [ ] 開発環境のデータ欠損確認
- [ ] ソースデータ（8月）の存在確認
- [ ] signage_imported_tempテーブルの確認

### リカバリ実行
- [ ] signage_imported_tempテーブル作成（必要な場合）
- [ ] 8月1日のテスト実行
- [ ] 第1週（8/1-8/7）のリカバリ
- [ ] 第2週（8/8-8/14）のリカバリ
- [ ] 第3週（8/15-8/21）のリカバリ
- [ ] 第4週（8/22-8/31）のリカバリ

### 検証
- [ ] 8月全日のデータ存在確認
- [ ] インプレッション数の妥当性確認
- [ ] エラーログの確認

### 事後確認
- [ ] 現在のETLプロセス動作確認
- [ ] Cloud Schedulerの設定確認
- [ ] 直近のデータ生成状況確認

## リスクと対処法

### リスク1: signage_imported_tempテーブル不在
**影響**: ETL処理がエラーになる
**対処**: ダミーテーブルを作成（デフォルト営業時間09:00-21:00が使用される）

### リスク2: タイムアウト
**影響**: 大量データ処理時に途中で失敗
**対処**: 週単位での分割処理

### リスク3: データ重複
**影響**: 同一日付のデータが重複する可能性
**対処**: ETLサービスの冪等性により自動的に既存データ削除→再投入される

### リスク4: ソースデータ不在
**影響**: リカバリ不可能
**対処**: バックアップやアーカイブの確認、データ再取得の検討

## 成功基準

1. 2025年8月1日〜31日の全日でデータが存在すること
2. 各日のrecord_countが0でないこと
3. total_impressionsに妥当な値が入っていること
4. エラーログが出力されていないこと
5. 現在のETLプロセスが正常に動作していること

## 完了後の作業

1. リカバリ結果レポートの作成
2. 再発防止策の検討
3. モニタリング強化の実施
4. バックアップ体制の見直し

## 連絡先

問題発生時は以下の情報と共に管理者へ連絡：
- 実行したコマンド
- エラーメッセージ
- 実行日時