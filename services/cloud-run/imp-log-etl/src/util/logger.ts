import winston from 'winston';

/**
 * アプリケーションロガー
 * Cloud Loggingと互換性のある構造化ログ形式を使用
 */
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'imp-log-etl' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          return `${timestamp} [${level}]: ${message} ${
            Object.keys(meta).length ? JSON.stringify(meta) : ''
          }`;
        })
      ),
    }),
  ],
});

/**
 * 環境変数に基づいてログレベルを設定
 */
export function configureLogger(): void {
  // 開発環境では詳細なログを出力
  if (process.env.NODE_ENV === 'development') {
    logger.level = 'debug';
  }

  // 本番環境ではCloud Loggingに適した形式を使用
  if (process.env.NODE_ENV === 'production') {
    logger.format = winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    );
  }

  logger.info(`Logger configured with level: ${logger.level}`);
}

/**
 * エラーオブジェクトをログ用に変換
 * @param error エラーオブジェクト
 * @returns ログ出力用のエラー情報
 */
export function formatError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      message: error.message,
      stack: error.stack,
      name: error.name,
    };
  }
  return { error };
}