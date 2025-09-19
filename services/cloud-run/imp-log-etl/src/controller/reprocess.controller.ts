import { Request, Response } from 'express';
import { EtlService } from '../service/etl.service';
import { DateUtil } from '../util/date.util';
import { logger } from '../util/logger';

/**
 * 再処理リクエストインターフェース
 */
interface ReprocessRequest {
  date: string;
}

/**
 * 再処理コントローラー
 * 特定の日付のデータを手動で再処理するためのエンドポイントを提供
 */
export class ReprocessController {
  private etlService: EtlService;

  constructor() {
    this.etlService = new EtlService();
  }

  /**
   * 特定の日付のデータを再処理
   * @param req HTTPリクエスト
   * @param res HTTPレスポンス
   */
  async reprocessDate(req: Request, res: Response): Promise<void> {
    try {
      const requestData = req.body as ReprocessRequest;
      
      if (!requestData || !requestData.date) {
        logger.error('Missing date parameter in request body');
        res.status(400).json({
          success: false,
          error: 'Missing date parameter in request body',
        });
        return;
      }
      
      if (!DateUtil.isValidDate(requestData.date)) {
        logger.error(`Invalid date format: ${requestData.date}`);
        res.status(400).json({
          success: false,
          error: `Invalid date format: ${requestData.date}. Expected format: YYYY-MM-DD`,
        });
        return;
      }
      
      const targetDate = new Date(requestData.date);
      logger.info(`Received reprocess request for date: ${requestData.date}`);
      
      // ETL処理を実行
      const result = await this.etlService.process(targetDate);
      
      // 結果に応じてレスポンスを返す
      if (result.success) {
        res.status(200).json(result);
      } else {
        res.status(500).json(result);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Unexpected error in reprocess controller', { error: errorMessage });
      
      res.status(500).json({
        success: false,
        error: errorMessage,
      });
    }
  }
}