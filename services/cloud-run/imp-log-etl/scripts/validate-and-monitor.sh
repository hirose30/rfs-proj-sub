#!/bin/bash
# データ検証とETLプロセスモニタリングスクリプト

echo "=========================================="
echo "データ検証とETLプロセスモニタリング"
echo "=========================================="
echo ""

# カラー定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 設定
PROJECT_ID="rfs-proj"
DATASET="sg_reports_tmp"
SERVICE_NAME="imp-log-etl-dev"

echo "プロジェクト: ${PROJECT_ID}"
echo "データセット: ${DATASET}"
echo "Cloud Runサービス: ${SERVICE_NAME}"
echo ""

# メニュー表示
show_menu() {
    echo -e "${BLUE}=== 検証メニュー ===${NC}"
    echo "1) 8月データの詳細検証"
    echo "2) 直近1週間のETL実行状況確認"
    echo "3) Cloud Runサービスのログ確認"
    echo "4) Cloud Schedulerジョブ確認"
    echo "5) データ整合性チェック"
    echo "6) 特定日付の詳細分析"
    echo "7) すべて実行"
    echo "0) 終了"
    echo ""
}

# 1. 8月データの詳細検証
validate_august_data() {
    echo -e "${YELLOW}=== 8月データの詳細検証 ===${NC}"
    echo ""
    
    echo "8月データの日別サマリー..."
    bq query --use_legacy_sql=false --format=pretty <<EOF
SELECT 
  DATE(timestamp_hourly) as date,
  COUNT(*) as record_count,
  SUM(imp) as total_impressions,
  COUNT(DISTINCT device_id) as unique_devices,
  COUNT(DISTINCT storeId) as unique_stores
FROM \`${PROJECT_ID}.${DATASET}.signage_impressions\`
WHERE DATE(timestamp_hourly) BETWEEN "2025-08-01" AND "2025-08-31"
GROUP BY date
ORDER BY date
EOF
    
    echo ""
    echo "8月データの時間別分布（サンプル: 8月15日）..."
    bq query --use_legacy_sql=false --format=pretty <<EOF
SELECT 
  EXTRACT(HOUR FROM timestamp_hourly) as hour,
  COUNT(*) as record_count,
  SUM(imp) as impressions
FROM \`${PROJECT_ID}.${DATASET}.signage_impressions\`
WHERE DATE(timestamp_hourly) = "2025-08-15"
GROUP BY hour
ORDER BY hour
EOF
    
    echo ""
    echo "欠損日の確認..."
    bq query --use_legacy_sql=false --format=pretty <<EOF
WITH august_dates AS (
  SELECT DATE('2025-08-01') + INTERVAL day DAY as expected_date
  FROM UNNEST(GENERATE_ARRAY(0, 30)) AS day
),
actual_dates AS (
  SELECT DISTINCT DATE(timestamp_hourly) as actual_date
  FROM \`${PROJECT_ID}.${DATASET}.signage_impressions\`
  WHERE DATE(timestamp_hourly) BETWEEN "2025-08-01" AND "2025-08-31"
)
SELECT 
  expected_date,
  CASE WHEN actual_date IS NULL THEN 'データなし' ELSE 'データあり' END as status
FROM august_dates
LEFT JOIN actual_dates ON august_dates.expected_date = actual_dates.actual_date
WHERE actual_date IS NULL
ORDER BY expected_date
EOF
}

# 2. 直近1週間のETL実行状況
check_recent_etl() {
    echo -e "${YELLOW}=== 直近1週間のETL実行状況 ===${NC}"
    echo ""
    
    CURRENT_DATE=$(date +%Y-%m-%d)
    WEEK_AGO=$(date -d "7 days ago" +%Y-%m-%d 2>/dev/null || date -v-7d +%Y-%m-%d)
    
    echo "直近7日間のデータ生成状況..."
    bq query --use_legacy_sql=false --format=pretty <<EOF
SELECT 
  DATE(timestamp_hourly) as date,
  COUNT(*) as record_count,
  SUM(imp) as total_impressions,
  MIN(timestamp_hourly) as earliest_record,
  MAX(timestamp_hourly) as latest_record
FROM \`${PROJECT_ID}.${DATASET}.signage_impressions\`
WHERE DATE(timestamp_hourly) >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
GROUP BY date
ORDER BY date DESC
EOF
}

# 3. Cloud Runサービスのログ確認
check_service_logs() {
    echo -e "${YELLOW}=== Cloud Runサービスのログ確認 ===${NC}"
    echo ""
    
    echo "直近のエラーログ（最新20件）..."
    gcloud logging read "resource.type=cloud_run_revision AND \
        resource.labels.service_name=${SERVICE_NAME} AND \
        severity>=ERROR" \
        --limit=20 \
        --format="table(timestamp,jsonPayload.message)" \
        --project=${PROJECT_ID} 2>/dev/null
    
    if [ $? -ne 0 ]; then
        echo -e "${RED}ログの取得に失敗しました。権限を確認してください。${NC}"
    fi
    
    echo ""
    echo "直近の実行ログ（最新10件）..."
    gcloud logging read "resource.type=cloud_run_revision AND \
        resource.labels.service_name=${SERVICE_NAME} AND \
        jsonPayload.message=~'Starting ETL process'" \
        --limit=10 \
        --format="table(timestamp,jsonPayload.message)" \
        --project=${PROJECT_ID} 2>/dev/null
}

# 4. Cloud Schedulerジョブ確認
check_scheduler() {
    echo -e "${YELLOW}=== Cloud Schedulerジョブ確認 ===${NC}"
    echo ""
    
    echo "Schedulerジョブ一覧..."
    gcloud scheduler jobs list \
        --location=asia-northeast1 \
        --project=${PROJECT_ID} \
        --format="table(name,schedule,timeZone,state,lastAttemptTime)" 2>/dev/null
    
    if [ $? -ne 0 ]; then
        echo -e "${RED}Schedulerジョブの取得に失敗しました。${NC}"
    fi
}

# 5. データ整合性チェック
check_data_integrity() {
    echo -e "${YELLOW}=== データ整合性チェック ===${NC}"
    echo ""
    
    echo "重複データのチェック（8月）..."
    bq query --use_legacy_sql=false --format=pretty <<EOF
WITH duplicates AS (
  SELECT 
    timestamp_hourly,
    mediumId,
    storeId,
    device_id,
    programId,
    sequence,
    creativeId,
    deliveryId,
    COUNT(*) as duplicate_count
  FROM \`${PROJECT_ID}.${DATASET}.signage_impressions\`
  WHERE DATE(timestamp_hourly) BETWEEN "2025-08-01" AND "2025-08-31"
  GROUP BY 1,2,3,4,5,6,7,8
  HAVING COUNT(*) > 1
)
SELECT 
  COUNT(*) as duplicate_groups,
  SUM(duplicate_count - 1) as total_duplicate_records
FROM duplicates
EOF
    
    echo ""
    echo "異常値チェック（負のインプレッション）..."
    bq query --use_legacy_sql=false --format=pretty <<EOF
SELECT 
  COUNT(*) as negative_imp_count
FROM \`${PROJECT_ID}.${DATASET}.signage_impressions\`
WHERE DATE(timestamp_hourly) BETWEEN "2025-08-01" AND "2025-08-31"
  AND imp < 0
EOF
    
    echo ""
    echo "営業時間外データのチェック..."
    bq query --use_legacy_sql=false --format=pretty <<EOF
SELECT 
  EXTRACT(HOUR FROM timestamp_hourly) as hour,
  COUNT(*) as record_count,
  SUM(imp) as impressions
FROM \`${PROJECT_ID}.${DATASET}.signage_impressions\`
WHERE DATE(timestamp_hourly) = "2025-08-15"
  AND (EXTRACT(HOUR FROM timestamp_hourly) < 9 OR EXTRACT(HOUR FROM timestamp_hourly) >= 22)
GROUP BY hour
ORDER BY hour
EOF
}

# 6. 特定日付の詳細分析
analyze_specific_date() {
    echo -e "${YELLOW}=== 特定日付の詳細分析 ===${NC}"
    echo ""
    
    read -p "分析する日付を入力してください (YYYY-MM-DD): " TARGET_DATE
    
    if [[ ! $TARGET_DATE =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]]; then
        echo -e "${RED}無効な日付形式です${NC}"
        return
    fi
    
    echo ""
    echo "${TARGET_DATE}のデータ分析..."
    
    # 基本統計
    bq query --use_legacy_sql=false --format=pretty <<EOF
SELECT 
  COUNT(*) as total_records,
  COUNT(DISTINCT device_id) as unique_devices,
  COUNT(DISTINCT storeId) as unique_stores,
  COUNT(DISTINCT creativeId) as unique_creatives,
  SUM(imp) as total_impressions,
  AVG(imp) as avg_impressions,
  MIN(imp) as min_impressions,
  MAX(imp) as max_impressions
FROM \`${PROJECT_ID}.${DATASET}.signage_impressions\`
WHERE DATE(timestamp_hourly) = "${TARGET_DATE}"
EOF
    
    echo ""
    echo "時間別分布..."
    bq query --use_legacy_sql=false --format=pretty <<EOF
SELECT 
  EXTRACT(HOUR FROM timestamp_hourly) as hour,
  COUNT(*) as records,
  SUM(imp) as impressions
FROM \`${PROJECT_ID}.${DATASET}.signage_impressions\`
WHERE DATE(timestamp_hourly) = "${TARGET_DATE}"
GROUP BY hour
ORDER BY hour
EOF
    
    echo ""
    echo "トップ10ストア..."
    bq query --use_legacy_sql=false --format=pretty <<EOF
SELECT 
  storeId,
  COUNT(*) as records,
  SUM(imp) as impressions
FROM \`${PROJECT_ID}.${DATASET}.signage_impressions\`
WHERE DATE(timestamp_hourly) = "${TARGET_DATE}"
GROUP BY storeId
ORDER BY impressions DESC
LIMIT 10
EOF
}

# 7. すべて実行
run_all() {
    validate_august_data
    echo ""
    check_recent_etl
    echo ""
    check_service_logs
    echo ""
    check_scheduler
    echo ""
    check_data_integrity
}

# メイン処理
while true; do
    show_menu
    read -p "選択してください: " choice
    echo ""
    
    case $choice in
        1) validate_august_data ;;
        2) check_recent_etl ;;
        3) check_service_logs ;;
        4) check_scheduler ;;
        5) check_data_integrity ;;
        6) analyze_specific_date ;;
        7) run_all ;;
        0) 
            echo "終了します"
            exit 0
            ;;
        *)
            echo -e "${RED}無効な選択です${NC}"
            ;;
    esac
    
    echo ""
    read -p "続行するには Enter キーを押してください..."
    echo ""
done