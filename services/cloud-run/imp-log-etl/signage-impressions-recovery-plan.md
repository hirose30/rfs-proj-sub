# signage_impressionsテーブル復旧計画

## 概要
`rfs-proj.sg_reports_tmp.signage_impressions`テーブルを再作成し、2025年7月分のインプレッションデータを投入する手順書です。

## 前提条件
- Google Cloud Shellへのアクセス権限
- `rfs-proj`プロジェクトへのアクセス権限
- BigQueryの編集権限
- Cloud Run `imp-log-etl-dev`サービスへのinvoker権限

## 実行手順

### ステップ1: Cloud Shellにログイン

1. [Google Cloud Console](https://console.cloud.google.com)にアクセス
2. プロジェクト`rfs-proj`を選択
3. Cloud Shellを起動（右上のターミナルアイコンをクリック）

### ステップ2: 必要なテーブルの作成

#### 2-1. signage_impressionsテーブルの作成

Cloud Shellで以下のコマンドを実行してテーブルを作成します：

```bash
bq query --use_legacy_sql=false '
CREATE TABLE IF NOT EXISTS `rfs-proj.sg_reports_tmp.signage_impressions` (
  timestamp_hourly TIMESTAMP,
  mediumId INT64,
  storeId INT64,
  device_id STRING,
  programId INT64,
  sequence INT64,
  creativeId INT64,
  deliveryId INT64,
  imp INT64,
  cnt INT64
)
PARTITION BY DATE(timestamp_hourly)
CLUSTER BY mediumId, storeId, creativeId'
```

#### 2-2. signage_imported_tempテーブルの作成（重要）

ETL処理に必要な営業時間情報テーブルを作成します。このテーブルが存在しないとETL処理がエラーになります：

```bash
# ダミーテーブルを作成（空でも処理は可能）
bq query --use_legacy_sql=false '
CREATE OR REPLACE TABLE `rfs-proj.sg_reports_tmp.signage_imported_temp` (
  fully_device_id STRING,
  opening_time STRING,
  closing_time STRING
)'
```

**注意**: このテーブルは空でも問題ありません。データがない場合はデフォルトの営業時間（09:00-21:00）が使用されます。

### ステップ3: 7月分データの投入

#### 方法A: 週単位での処理（推奨 - タイムアウト対策）

タイムアウトを避けるため、週単位で処理することを推奨します：

```bash
# 第1週（7/1-7/7）
curl -X GET \
  -H "Authorization: Bearer $(gcloud auth print-identity-token)" \
  "https://imp-log-etl-dev-548006961857.asia-northeast1.run.app/run-range?startDate=2025-07-01&endDate=2025-07-07"

# 第2週（7/8-7/14）
curl -X GET \
  -H "Authorization: Bearer $(gcloud auth print-identity-token)" \
  "https://imp-log-etl-dev-548006961857.asia-northeast1.run.app/run-range?startDate=2025-07-08&endDate=2025-07-14"

# 第3週（7/15-7/21）
curl -X GET \
  -H "Authorization: Bearer $(gcloud auth print-identity-token)" \
  "https://imp-log-etl-dev-548006961857.asia-northeast1.run.app/run-range?startDate=2025-07-15&endDate=2025-07-21"

# 第4週以降（7/22-7/31）
curl -X GET \
  -H "Authorization: Bearer $(gcloud auth print-identity-token)" \
  "https://imp-log-etl-dev-548006961857.asia-northeast1.run.app/run-range?startDate=2025-07-22&endDate=2025-07-31"
```

#### 方法B: 日単位での処理（確実だが時間がかかる）

より確実に処理したい場合は、1日ずつ処理します：

```bash
# bashスクリプトで自動化
for day in {01..31}; do
  echo "Processing 2025-07-${day}..."
  curl -X GET \
    -H "Authorization: Bearer $(gcloud auth print-identity-token)" \
    "https://imp-log-etl-dev-548006961857.asia-northeast1.run.app/run?date=2025-07-${day}"
  echo "Completed 2025-07-${day}. Waiting 2 seconds..."
  sleep 2
done
```

#### 方法C: 一括処理（タイムアウトリスクあり）

```bash
# タイムアウト時間を延長して実行（最大600秒）
curl -X GET \
  -H "Authorization: Bearer $(gcloud auth print-identity-token)" \
  --max-time 600 \
  "https://imp-log-etl-dev-548006961857.asia-northeast1.run.app/run-range?startDate=2025-07-01&endDate=2025-07-31"
```

**注意事項：**
- 方法Aの週単位処理が最もバランスが良い
- 各コマンドの実行後、結果を確認してから次を実行することを推奨
- Cloud Shellのセッションタイムアウト（20分）に注意

### ステップ4: 処理結果の確認

データが正しく投入されたか確認します：

```bash
bq query --use_legacy_sql=false '
SELECT 
  DATE(timestamp_hourly) as date,
  COUNT(*) as record_count,
  SUM(imp) as total_impressions
FROM `rfs-proj.sg_reports_tmp.signage_impressions`
WHERE DATE(timestamp_hourly) BETWEEN "2025-07-01" AND "2025-07-31"
GROUP BY date
ORDER BY date'
```

期待される結果：
- 7月1日から31日まで、各日付にデータが存在すること
- `record_count`が0でないこと
- `total_impressions`に妥当な値が入っていること

## 重要：signage_imported_tempテーブルの問題

### エラー内容
`Not found: Table rfs-proj:sg_reports_tmp.signage_imported_temp was not found`

このテーブルは店舗営業時間情報を提供しますが、現在存在しません。以下の対処法があります：

### 対処法1: 一時的なダミーテーブルを作成（推奨）

```bash
# 最小限のダミーテーブルを作成
bq query --use_legacy_sql=false '
CREATE OR REPLACE TABLE `rfs-proj.sg_reports_tmp.signage_imported_temp` (
  fully_device_id STRING,
  opening_time STRING,
  closing_time STRING
)'

# 空のテーブルでも処理は進行（デフォルト営業時間09:00-21:00が使用される）
```

### 対処法2: 実際のデータを確認してテーブルを作成

```bash
# 既存の類似テーブルを探す
bq ls -a sg_reports_tmp | grep signage

# もし別の名前で存在する場合は、ビューを作成
# 例：signage_master が存在する場合
bq query --use_legacy_sql=false '
CREATE OR REPLACE VIEW `rfs-proj.sg_reports_tmp.signage_imported_temp` AS
SELECT 
  device_id as fully_device_id,
  opening_time,
  closing_time
FROM `rfs-proj.sg_reports_tmp.signage_master`'
```

### 対処法3: クエリを修正してテーブル参照を削除

この場合は、コードの修正が必要になるため、一時的な対処法として上記1または2を推奨します。

## トラブルシューティング

### データが1件もインポートされない場合の調査手順

データがインポートされない原因を特定するため、以下のクエリを順番に実行してください：

#### 1. ソーステーブルのデータ存在確認（7月のデータが存在するか）

```bash
# 7月のrequestsテーブルのデータ件数確認
bq query --use_legacy_sql=false '
SELECT 
  DATE(TIMESTAMP_ADD(TIMESTAMP, INTERVAL 9 HOUR)) as jst_date,
  COUNT(*) as record_count
FROM `rfs-proj.rfs_events.requests`
WHERE DATE(TIMESTAMP_ADD(TIMESTAMP, INTERVAL 9 HOUR)) BETWEEN "2025-07-01" AND "2025-07-31"
  AND regexp_extract(httpRequest.requestUrl, "//[^/]+([^?#]+)") = "/tracking"
GROUP BY jst_date
ORDER BY jst_date
LIMIT 10'
```

#### 2. フィルタ条件の影響を確認

```bash
# 各フィルタ条件でどれくらいデータが絞られるか確認
bq query --use_legacy_sql=false '
SELECT 
  COUNT(*) as total_records,
  COUNTIF(regexp_extract(httpRequest.requestUrl, "//[^/]+([^?#]+)") = "/tracking") as tracking_records,
  COUNTIF(rfs_events.url_parse(httpRequest.requestUrl, "event") = "complete") as complete_events,
  COUNTIF(rfs_events.url_parse(httpRequest.requestUrl, "send_ts") != "") as with_send_ts,
  COUNTIF(rfs_events.url_parse(httpRequest.requestUrl, "networkId") = "1") as network_1
FROM `rfs-proj.rfs_events.requests`
WHERE DATE(TIMESTAMP_ADD(TIMESTAMP, INTERVAL 9 HOUR)) = "2025-07-01"'
```

#### 3. 営業時間フィルタの影響確認

```bash
# 営業時間フィルタ（10:00-22:00）を外した場合のデータ件数
bq query --use_legacy_sql=false '
SELECT 
  DATE(TIMESTAMP_ADD(TIMESTAMP, INTERVAL 9 HOUR)) as jst_date,
  COUNT(*) as total_count,
  SUM(CASE 
    WHEN FORMAT_TIMESTAMP("%H:%M", TIMESTAMP_ADD(TIMESTAMP, INTERVAL 9 HOUR)) >= "10:00" 
     AND FORMAT_TIMESTAMP("%H:%M", TIMESTAMP_ADD(TIMESTAMP, INTERVAL 9 HOUR)) < "22:00"
    THEN 1 ELSE 0 END) as within_hours_count
FROM `rfs-proj.rfs_events.requests`
WHERE DATE(TIMESTAMP_ADD(TIMESTAMP, INTERVAL 9 HOUR)) = "2025-07-01"
  AND regexp_extract(httpRequest.requestUrl, "//[^/]+([^?#]+)") = "/tracking"
  AND rfs_events.url_parse(httpRequest.requestUrl, "event") = "complete"
GROUP BY jst_date'
```

#### 4. 実際のURLパラメータ値を確認

```bash
# どのようなeventやnetworkIdが存在するか確認
bq query --use_legacy_sql=false '
SELECT 
  rfs_events.url_parse(httpRequest.requestUrl, "event") as event_type,
  rfs_events.url_parse(httpRequest.requestUrl, "networkId") as network_id,
  COUNT(*) as count
FROM `rfs-proj.rfs_events.requests`
WHERE DATE(TIMESTAMP_ADD(TIMESTAMP, INTERVAL 9 HOUR)) = "2025-07-01"
  AND regexp_extract(httpRequest.requestUrl, "//[^/]+([^?#]+)") = "/tracking"
GROUP BY event_type, network_id
ORDER BY count DESC
LIMIT 20'
```

#### 5. デバッグ用：フィルタを緩めたクエリで確認

```bash
# 最小限のフィルタでデータを確認
bq query --use_legacy_sql=false '
SELECT 
  TIMESTAMP_ADD(TIMESTAMP, INTERVAL 9 HOUR) as jst_timestamp,
  httpRequest.requestUrl,
  rfs_events.url_parse(httpRequest.requestUrl, "event") as event,
  rfs_events.url_parse(httpRequest.requestUrl, "networkId") as networkId
FROM `rfs-proj.rfs_events.requests`
WHERE DATE(TIMESTAMP_ADD(TIMESTAMP, INTERVAL 9 HOUR)) = "2025-07-01"
  AND httpRequest.requestUrl LIKE "%tracking%"
LIMIT 10'
```

### 一般的な原因と対処法

1. **日付の問題**: TIMESTAMPフィールドがUTCで、JSTへの変換（+9時間）が必要
2. **networkId = '1'の条件**: 実際のデータではnetworkIdが異なる値の可能性
3. **event = 'complete'の条件**: 実際のデータではeventが異なる値の可能性
4. **営業時間フィルタ**: デフォルトの09:00-21:00でフィルタされ、imp > 0の条件でデータが除外

## トラブルシューティング

### 特定の日付でエラーが発生した場合

`/run-range`のレスポンスに`failedDates`が含まれている場合、失敗した日付のみ個別に再実行します：

```bash
# 例：7月15日のデータを再処理
curl -X GET \
  -H "Authorization: Bearer $(gcloud auth print-identity-token)" \
  "https://imp-log-etl-dev-548006961857.asia-northeast1.run.app/run?date=2025-07-15"
```

### 認証エラーが発生した場合

以下のコマンドで再認証を試みます：

```bash
# 再認証
gcloud auth login
gcloud auth application-default login

# プロジェクトを設定
gcloud config set project rfs-proj
```

### テーブルが既に存在するエラーが発生した場合

既存のテーブルを削除してから再作成します：

```bash
# 既存テーブルを削除（注意：データが消えます）
bq rm -f -t rfs-proj:sg_reports_tmp.signage_impressions

# その後、ステップ2のテーブル作成コマンドを再実行
```

## 処理時間の目安

- テーブル作成: 数秒
- 7月分データ投入（31日分）: 5〜10分
- データ確認クエリ: 数秒

## 重複実行時の動作

**重要：このETLサービスは冪等性（idempotency）を持つ設計になっています。**

同じ日付で複数回実行しても、データは重複しません：

1. **処理の流れ**
   - 指定日付の既存データをDELETE
   - ソースから再度データを集計
   - 新しいデータをINSERT

2. **例：7月1日を2回実行した場合**
   - 1回目：362,275件を挿入
   - 2回目：既存の362,275件を削除 → 再度362,275件を挿入
   - **結果：362,275件（重複なし）**

3. **メリット**
   - エラー時の再実行が安全
   - データの整合性が保たれる
   - 手動での重複チェック不要

## 補足情報

### ETLサービスの仕様

- **エンドポイント**: `https://imp-log-etl-dev-548006961857.asia-northeast1.run.app`
- **データソース**: `rfs_events.requests`テーブル
- **処理内容**: 時間別インプレッション集計
- **フィルタ条件**: 
  - event='complete'
  - networkId='1'
  - 店舗営業時間内のデータのみ集計

### テーブル構造

- **パーティション**: 日付単位（`timestamp_hourly`カラム）
- **クラスタリング**: `mediumId`, `storeId`, `creativeId`
- **データ保持期間**: 無期限

## 実行順序まとめ（クイックリファレンス）

### テーブル作成
```bash
# 1. signage_impressionsテーブル作成
bq query --use_legacy_sql=false 'CREATE TABLE IF NOT EXISTS `rfs-proj.sg_reports_tmp.signage_impressions` (timestamp_hourly TIMESTAMP, mediumId INT64, storeId INT64, device_id STRING, programId INT64, sequence INT64, creativeId INT64, deliveryId INT64, imp INT64, cnt INT64) PARTITION BY DATE(timestamp_hourly) CLUSTER BY mediumId, storeId, creativeId'

# 2. signage_imported_tempテーブル作成（重要！）
bq query --use_legacy_sql=false 'CREATE OR REPLACE TABLE `rfs-proj.sg_reports_tmp.signage_imported_temp` (fully_device_id STRING, opening_time STRING, closing_time STRING)'
```

### データ投入（週単位 - 推奨）
```bash
# 週単位で処理（タイムアウト対策）
curl -X GET -H "Authorization: Bearer $(gcloud auth print-identity-token)" "https://imp-log-etl-dev-548006961857.asia-northeast1.run.app/run-range?startDate=2025-07-01&endDate=2025-07-07"
curl -X GET -H "Authorization: Bearer $(gcloud auth print-identity-token)" "https://imp-log-etl-dev-548006961857.asia-northeast1.run.app/run-range?startDate=2025-07-08&endDate=2025-07-14"
curl -X GET -H "Authorization: Bearer $(gcloud auth print-identity-token)" "https://imp-log-etl-dev-548006961857.asia-northeast1.run.app/run-range?startDate=2025-07-15&endDate=2025-07-21"
curl -X GET -H "Authorization: Bearer $(gcloud auth print-identity-token)" "https://imp-log-etl-dev-548006961857.asia-northeast1.run.app/run-range?startDate=2025-07-22&endDate=2025-07-31"
```

### 結果確認
```bash
# データ投入状況確認
bq query --use_legacy_sql=false 'SELECT DATE(timestamp_hourly) as date, COUNT(*) as record_count, SUM(imp) as total_impressions FROM `rfs-proj.sg_reports_tmp.signage_impressions` WHERE DATE(timestamp_hourly) BETWEEN "2025-07-01" AND "2025-07-31" GROUP BY date ORDER BY date'
```

## 完了確認チェックリスト

- [ ] signage_impressionsテーブルが作成されている
- [ ] signage_imported_tempテーブルが作成されている
- [ ] 7月1日〜31日のデータが存在する
- [ ] 各日付のレコード数が妥当である
- [ ] エラーメッセージが出ていない

## 問い合わせ先

問題が発生した場合は、以下の情報と共に管理者に連絡してください：
- 実行したコマンド
- エラーメッセージ（あれば）
- 実行日時