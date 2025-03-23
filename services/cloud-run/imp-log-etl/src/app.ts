import express, { Request, Response, NextFunction } from 'express';
import { EtlController } from './controller/etl.controller';
import { ReprocessController } from './controller/reprocess.controller';
import { logger, configureLogger } from './util/logger';

/**
 * Expressアプリケーションを初期化
 * @returns 設定済みのExpressアプリケーション
 */
export function createApp(): express.Application {
  // ロガーを設定
  configureLogger();
  
  // Expressアプリケーションを作成
  const app = express();
  
  // ミドルウェアを設定
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  
  // リクエストロギングミドルウェア
  app.use((req: Request, _res: Response, next: NextFunction) => {
    logger.info(`${req.method} ${req.path}`, {
      query: req.query,
      ip: req.ip,
    });
    next();
  });
  
  // コントローラーをインスタンス化
  const etlController = new EtlController();
  const reprocessController = new ReprocessController();
  
  // ルートを設定
  app.get('/run', (req, res) => etlController.runEtl(req, res));
  app.post('/reprocess', (req, res) => reprocessController.reprocessDate(req, res));
  
  // ヘルスチェックエンドポイント
  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });
  
  // 404ハンドラー
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: 'Not Found' });
  });
  
  // エラーハンドラー
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    logger.error('Unhandled error', { error: err.message, stack: err.stack });
    res.status(500).json({ error: 'Internal Server Error' });
  });
  
  return app;
}