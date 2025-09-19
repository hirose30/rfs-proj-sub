#!/bin/bash
# 8月データリカバリ実行スクリプト

set -e  # エラー時に停止

echo "=========================================="
echo "signage_impressions 8月データリカバリ"
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
SERVICE_URL="https://imp-log-etl-dev-548006961857.asia-northeast1.run.app"
DATASET="sg_reports_tmp"

echo "プロジェクト: ${PROJECT_ID}"
echo "データセット: ${DATASET}"
echo "Cloud Runサービス: ${SERVICE_URL}"
echo ""

# 実行確認
echo -e "${YELLOW}このスクリプトは以下の処理を実行します:${NC}"
echo "1. signage_imported_tempテーブルの確認/作成"
echo "2. 8月1日のテストリカバリ"
echo "3. 8月全体のデータリカバリ（週単位）"
echo ""
read -p "続行しますか？ (y/N): " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "キャンセルしました"
    exit 1
fi

echo ""
echo -e "${BLUE}=== ステップ1: 補助テーブルの準備 ===${NC}"
echo ""

# signage_imported_tempテーブルの確認
echo "signage_imported_tempテーブルを確認中..."
if bq show ${PROJECT_ID}:${DATASET}.signage_imported_temp &>/dev/null; then
    echo -e "${GREEN}signage_imported_tempテーブルは既に存在します${NC}"
    
    # データ件数確認
    COUNT=$(bq query --use_legacy_sql=false --format=csv --max_rows=1 \
        "SELECT COUNT(*) FROM \`${PROJECT_ID}.${DATASET}.signage_imported_temp\`" | tail -n 1)
    echo "レコード数: ${COUNT}"
    
    if [ "$COUNT" -eq "0" ]; then
        echo -e "${YELLOW}テーブルは空です。デフォルト営業時間(09:00-21:00)が使用されます${NC}"
    fi
else
    echo -e "${YELLOW}signage_imported_tempテーブルが存在しません。作成します...${NC}"
    
    # テーブル作成
    bq query --use_legacy_sql=false <<EOF
CREATE OR REPLACE TABLE \`${PROJECT_ID}.${DATASET}.signage_imported_temp\` (
  fully_device_id STRING,
  opening_time STRING,
  closing_time STRING
)
EOF
    
    echo -e "${GREEN}signage_imported_tempテーブルを作成しました${NC}"
    echo "注: 空のテーブルのため、デフォルト営業時間(09:00-21:00)が使用されます"
fi

echo ""
echo -e "${BLUE}=== ステップ2: 認証確認 ===${NC}"
echo ""

# 認証トークンの取得テスト
echo "Google Cloud認証を確認中..."
TOKEN=$(gcloud auth print-identity-token 2>/dev/null)
if [ $? -eq 0 ]; then
    echo -e "${GREEN}認証OK${NC}"
else
    echo -e "${RED}認証エラー。以下のコマンドを実行してください:${NC}"
    echo "gcloud auth login"
    echo "gcloud auth application-default login"
    exit 1
fi

echo ""
echo -e "${BLUE}=== ステップ3: 8月1日のテストリカバリ ===${NC}"
echo ""

echo "8月1日のデータでテスト実行します..."
read -p "テスト実行を行いますか？ (y/N): " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "8月1日のデータを処理中..."
    
    RESPONSE=$(curl -s -X GET \
        -H "Authorization: Bearer $(gcloud auth print-identity-token)" \
        "${SERVICE_URL}/run?date=2025-08-01")
    
    echo "レスポンス: ${RESPONSE}"
    
    # 結果確認
    echo ""
    echo "8月1日のデータを確認中..."
    bq query --use_legacy_sql=false --format=pretty <<EOF
SELECT 
  DATE(timestamp_hourly) as date,
  COUNT(*) as record_count,
  SUM(imp) as total_impressions
FROM \`${PROJECT_ID}.${DATASET}.signage_impressions\`
WHERE DATE(timestamp_hourly) = "2025-08-01"
EOF
    
    read -p "結果は正常ですか？続行しますか？ (y/N): " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "処理を中止しました"
        exit 1
    fi
else
    echo "テスト実行をスキップしました"
fi

echo ""
echo -e "${BLUE}=== ステップ4: 8月全体のリカバリ ===${NC}"
echo ""

echo -e "${YELLOW}週単位で8月データをリカバリします${NC}"
echo "処理には時間がかかる場合があります..."
echo ""

# 実行関数
process_week() {
    local START_DATE=$1
    local END_DATE=$2
    local WEEK_NAME=$3
    
    echo -e "${YELLOW}${WEEK_NAME}（${START_DATE}〜${END_DATE}）を処理中...${NC}"
    
    RESPONSE=$(curl -s -X GET \
        -H "Authorization: Bearer $(gcloud auth print-identity-token)" \
        --max-time 600 \
        "${SERVICE_URL}/run-range?startDate=${START_DATE}&endDate=${END_DATE}")
    
    # 成功チェック
    if echo "$RESPONSE" | grep -q '"success":true'; then
        echo -e "${GREEN}${WEEK_NAME}の処理が完了しました${NC}"
        
        # 処理件数を抽出（可能な場合）
        if echo "$RESPONSE" | grep -q 'totalRowCount'; then
            ROWS=$(echo "$RESPONSE" | grep -o '"totalRowCount":[0-9]*' | cut -d: -f2)
            echo "処理レコード数: ${ROWS}"
        fi
    else
        echo -e "${RED}${WEEK_NAME}の処理でエラーが発生しました${NC}"
        echo "レスポンス: ${RESPONSE}"
        
        read -p "続行しますか？ (y/N): " -n 1 -r
        echo ""
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
    
    echo ""
    sleep 2  # APIへの負荷軽減
}

# 各週を処理
read -p "8月全体のリカバリを開始しますか？ (y/N): " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    process_week "2025-08-01" "2025-08-07" "第1週"
    process_week "2025-08-08" "2025-08-14" "第2週"
    process_week "2025-08-15" "2025-08-21" "第3週"
    process_week "2025-08-22" "2025-08-31" "第4週"
else
    echo "8月全体のリカバリをスキップしました"
fi

echo ""
echo -e "${BLUE}=== ステップ5: 最終確認 ===${NC}"
echo ""

echo "8月データの最終確認..."
bq query --use_legacy_sql=false --format=pretty <<EOF
SELECT 
  DATE(timestamp_hourly) as date,
  COUNT(*) as record_count,
  SUM(imp) as total_impressions
FROM \`${PROJECT_ID}.${DATASET}.signage_impressions\`
WHERE DATE(timestamp_hourly) BETWEEN "2025-08-01" AND "2025-08-31"
GROUP BY date
ORDER BY date
EOF

echo ""
echo "8月データのサマリー..."
bq query --use_legacy_sql=false --format=pretty <<EOF
SELECT 
  MIN(DATE(timestamp_hourly)) as first_date,
  MAX(DATE(timestamp_hourly)) as last_date,
  COUNT(DISTINCT DATE(timestamp_hourly)) as days_with_data,
  COUNT(*) as total_records,
  SUM(imp) as total_impressions
FROM \`${PROJECT_ID}.${DATASET}.signage_impressions\`
WHERE DATE(timestamp_hourly) BETWEEN "2025-08-01" AND "2025-08-31"
EOF

echo ""
echo -e "${GREEN}=== リカバリ処理完了 ===${NC}"
echo ""
echo "次のステップ:"
echo "1. 上記の結果を確認してください"
echo "2. 必要に応じて個別の日付を再処理してください"
echo "3. ステージング/本番環境へのリカバリも検討してください"
echo ""