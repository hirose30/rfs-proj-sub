# 8月データリカバリ作業ガイド

## 概要
signage_impressionsテーブルの2025年8月データが欠損しているため、リカバリを実施します。

## 作成したファイル

### 1. 計画書
- `august-data-recovery-plan.md` - 詳細な作業計画とチェックリスト

### 2. 実行スクリプト
- `scripts/check-august-data.sh` - データ欠損状況の確認
- `scripts/setup-and-recover-august.sh` - リカバリ実行（メインスクリプト）
- `scripts/validate-and-monitor.sh` - データ検証とモニタリング

## クイックスタート

### ステップ1: 現状確認
```bash
cd services/cloud-run/imp-log-etl
./scripts/check-august-data.sh
```

### ステップ2: リカバリ実行
```bash
./scripts/setup-and-recover-august.sh
```

### ステップ3: 結果検証
```bash
./scripts/validate-and-monitor.sh
# メニューから「1」を選択して8月データを検証
```

## 重要な注意事項

1. **認証**: 実行前に以下のコマンドで認証してください
   ```bash
   gcloud auth login
   gcloud auth application-default login
   gcloud config set project rfs-proj
   ```

2. **実行環境**: Google Cloud Shell または gcloud CLI がインストールされた環境で実行

3. **実行順序**: 必ず確認→リカバリ→検証の順で実行

4. **タイムアウト対策**: リカバリは週単位で実行されます（各週約5-10分）

## トラブルシューティング

### signage_imported_tempテーブルが存在しない
- `setup-and-recover-august.sh`が自動的に作成します

### 認証エラー
- 上記の認証コマンドを再実行してください

### 特定の日付のみ失敗
- 個別に再実行:
  ```bash
  curl -X GET \
    -H "Authorization: Bearer $(gcloud auth print-identity-token)" \
    "https://imp-log-etl-dev-548006961857.asia-northeast1.run.app/run?date=2025-08-XX"
  ```

## 成功基準
- 8月1日〜31日の全日でデータが存在
- 各日のrecord_countが0より大きい
- エラーログなし

## サポート
問題が発生した場合は、エラーメッセージと実行日時を記録して管理者に連絡してください。