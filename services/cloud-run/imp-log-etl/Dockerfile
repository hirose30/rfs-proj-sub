# ビルドステージ
FROM node:18-slim AS builder

WORKDIR /app

# パッケージ依存関係をコピー
COPY package*.json ./

# 依存関係をインストール
RUN npm ci

# ソースコードをコピー
COPY . .

# TypeScriptをコンパイル
RUN npm run build

# 実行ステージ
FROM node:18-slim

WORKDIR /app

# パッケージ依存関係をコピー
COPY package*.json ./

# 本番依存関係のみをインストール
RUN npm ci --only=production

# ビルドステージからコンパイル済みのコードをコピー
COPY --from=builder /app/dist ./dist

# 環境変数を設定
ENV NODE_ENV=production
ENV PORT=8080

# ヘルスチェックのためのポートを公開
EXPOSE 8080

# アプリケーションを実行（ガベージコレクションを明示的に実行できるようにする）
CMD ["node", "--expose-gc", "dist/index.js"]