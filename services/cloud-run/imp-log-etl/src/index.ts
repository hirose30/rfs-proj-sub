import { createApp } from './app';
import { logger } from './util/logger';

// 環境変数からポート番号を取得（デフォルト: 8080）
const PORT = process.env.PORT || 8080;

// アプリケーションを作成
const app = createApp();

// サーバーを起動
const server = app.listen(PORT, () => {
  logger.info(`Server started on port ${PORT}`);
  logger.info('Press Ctrl+C to quit');
});

// グレースフルシャットダウンの設定
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
  
  // 10秒後に強制終了
  setTimeout(() => {
    logger.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
  
  // 10秒後に強制終了
  setTimeout(() => {
    logger.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
});

// 未処理の例外をキャッチ
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', { error: error.message, stack: error.stack });
  process.exit(1);
});

// 未処理のPromiseリジェクションをキャッチ
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', { promise, reason });
  process.exit(1);
});