#!/bin/bash
# 8月1日〜11日のデータリカバリ専用スクリプト

set -e

echo "=========================================="
echo "8月1日〜11日 データリカバリ"
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
SERVICE_URL="https://imp-log-etl-dev-jxjuukneea-an.a.run.app"
DATASET="sg_reports_tmp"

echo "プロジェクト: ${PROJECT_ID}"
echo "データセット: ${DATASET}"
echo "Cloud Runサービス: ${SERVICE_URL}"
echo ""

# 認証確認
echo -e "${BLUE}=== 認証確認 ===${NC}"
TOKEN=$(gcloud auth print-identity-token 2>/dev/null)
if [ $? -eq 0 ]; then
    echo -e "${GREEN}認証OK${NC}"
else
    echo -e "${RED}認証エラー。以下のコマンドを実行してください:${NC}"
    echo "gcloud auth login"
    exit 1
fi

echo ""
echo -e "${BLUE}=== 8月1日〜11日のリカバリ開始 ===${NC}"
echo ""

# 成功・失敗カウンタ
SUCCESS_COUNT=0
FAILED_COUNT=0
FAILED_DATES=""

# 8月1日〜11日を処理
for day in {01..11}; do
    DATE="2025-08-${day}"
    echo -e "${YELLOW}処理中: ${DATE}${NC}"
    
    # Cloud Runサービスを呼び出し
    RESPONSE=$(curl -s -X GET \
        -H "Authorization: Bearer $(gcloud auth print-identity-token)" \
        "${SERVICE_URL}/run?date=${DATE}" 2>&1)
    
    # レスポンスチェック
    if echo "$RESPONSE" | grep -q '"success":true'; then
        echo -e "${GREEN}✓ ${DATE} 完了${NC}"
        SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
        
        # 処理件数を抽出（可能な場合）
        if echo "$RESPONSE" | grep -q 'rowCount'; then
            ROWS=$(echo "$RESPONSE" | grep -o '"rowCount":[0-9]*' | cut -d: -f2)
            echo "  処理レコード数: ${ROWS}"
        fi
    else
        echo -e "${RED}✗ ${DATE} 失敗${NC}"
        echo "  エラー: ${RESPONSE}" | head -n 3
        FAILED_COUNT=$((FAILED_COUNT + 1))
        FAILED_DATES="${FAILED_DATES} ${DATE}"
    fi
    
    # API負荷軽減のため少し待機
    sleep 2
done

echo ""
echo -e "${BLUE}=== リカバリ完了 ===${NC}"
echo ""
echo "成功: ${SUCCESS_COUNT}日"
echo "失敗: ${FAILED_COUNT}日"

if [ ${FAILED_COUNT} -gt 0 ]; then
    echo -e "${RED}失敗した日付: ${FAILED_DATES}${NC}"
fi

echo ""
echo -e "${BLUE}=== データ確認 ===${NC}"
echo ""

# 8月1日〜11日のデータ確認
bq query --use_legacy_sql=false --format=pretty <<EOF
SELECT 
  DATE(timestamp_hourly) as date,
  COUNT(*) as record_count,
  SUM(imp) as total_impressions
FROM \`${PROJECT_ID}.${DATASET}.signage_impressions\`
WHERE DATE(timestamp_hourly) BETWEEN "2025-08-01" AND "2025-08-11"
GROUP BY date
ORDER BY date
EOF

echo ""
echo -e "${GREEN}=== 処理完了 ===${NC}"