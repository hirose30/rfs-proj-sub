#!/bin/bash
# 8月データ欠損状況確認スクリプト

echo "=========================================="
echo "signage_impressions 8月データ確認スクリプト"
echo "=========================================="
echo ""

# カラー定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# プロジェクトID
PROJECT_ID="rfs-proj"

echo "プロジェクト: ${PROJECT_ID}"
echo ""

# 1. データ欠損状況確認
echo -e "${YELLOW}=== ステップ1: データ欠損状況確認 ===${NC}"
echo ""

echo "開発環境 (sg_reports_tmp) のデータ確認..."
bq query --use_legacy_sql=false --format=pretty <<EOF
SELECT 
  DATE(timestamp_hourly) as date,
  COUNT(*) as record_count,
  SUM(imp) as total_impressions
FROM \`${PROJECT_ID}.sg_reports_tmp.signage_impressions\`
WHERE DATE(timestamp_hourly) BETWEEN "2025-07-25" AND "2025-09-05"
GROUP BY date
ORDER BY date
EOF


echo ""
echo -e "${YELLOW}=== ステップ2: 8月のソースデータ存在確認 ===${NC}"
echo ""

echo "2.1 8月のソースデータ概要..."
bq query --use_legacy_sql=false --format=pretty <<EOF
SELECT 
  DATE(TIMESTAMP_ADD(TIMESTAMP, INTERVAL 9 HOUR)) as jst_date,
  COUNT(*) as total_records,
  COUNTIF(regexp_extract(httpRequest.requestUrl, '//[^/]+([^?#]+)') = '/tracking') as tracking_records,
  COUNTIF(rfs_events.url_parse(httpRequest.requestUrl, 'event') = 'complete') as complete_events,
  COUNTIF(rfs_events.url_parse(httpRequest.requestUrl, 'networkId') = '1') as network_1
FROM \`${PROJECT_ID}.rfs_events.requests\`
WHERE DATE(TIMESTAMP_ADD(TIMESTAMP, INTERVAL 9 HOUR)) BETWEEN "2025-08-01" AND "2025-08-05"
GROUP BY jst_date
ORDER BY jst_date
LIMIT 5
EOF

echo ""
echo "2.2 8月全体のソースデータサマリー..."
bq query --use_legacy_sql=false --format=pretty <<EOF
SELECT 
  COUNT(*) as total_records,
  COUNTIF(regexp_extract(httpRequest.requestUrl, '//[^/]+([^?#]+)') = '/tracking') as tracking_records,
  COUNTIF(rfs_events.url_parse(httpRequest.requestUrl, 'event') = 'complete' 
    AND rfs_events.url_parse(httpRequest.requestUrl, 'networkId') = '1'
    AND regexp_extract(httpRequest.requestUrl, '//[^/]+([^?#]+)') = '/tracking') as eligible_records
FROM \`${PROJECT_ID}.rfs_events.requests\`
WHERE DATE(TIMESTAMP_ADD(TIMESTAMP, INTERVAL 9 HOUR)) BETWEEN "2025-08-01" AND "2025-08-31"
EOF

echo ""
echo -e "${YELLOW}=== ステップ3: 補助テーブルの確認 ===${NC}"
echo ""

echo "3.1 signage_imported_tempテーブルの存在確認..."
bq ls -a ${PROJECT_ID}:sg_reports_tmp | grep -E "signage_imported" || echo -e "${RED}signage_imported_tempテーブルが見つかりません${NC}"

# テーブルが存在する場合のみ件数確認
if bq show ${PROJECT_ID}:sg_reports_tmp.signage_imported_temp &>/dev/null; then
    echo ""
    echo "3.2 signage_imported_tempテーブルのデータ件数..."
    bq query --use_legacy_sql=false --format=pretty <<EOF
SELECT COUNT(*) as record_count
FROM \`${PROJECT_ID}.sg_reports_tmp.signage_imported_temp\`
EOF
else
    echo -e "${RED}signage_imported_tempテーブルが存在しないため、作成が必要です${NC}"
fi

echo ""
echo -e "${GREEN}=== データ確認完了 ===${NC}"
echo ""
echo "次のステップ:"
echo "1. 上記の結果を確認して、8月データの欠損状況を把握してください"
echo "2. ソースデータが存在する場合は、リカバリ可能です"
echo "3. signage_imported_tempテーブルが存在しない場合は、作成してください"
echo ""