import { Request, Response } from 'express';
import { EtlService, ETLResponse } from '../service/etl.service';
import { DateUtil } from '../util/date.util';
import { logger } from '../util/logger';

/**
 * ETLコントローラー
 * HTTPリクエストを処理し、ETLサービスを呼び出す
 */
export class EtlController {
  private etlService: EtlService;

  constructor() {
    this.etlService = new EtlService();
  }

  /**
   * ETL処理を実行
   * @param req HTTPリクエスト
   * @param res HTTPレスポンス
   */
  async runEtl(req: Request, res: Response): Promise<void> {
    try {
      // リクエストから日付パラメータを取得（指定がなければ前日）
      const dateParam = req.query.date as string | undefined;
      const targetDate = dateParam 
        ? new Date(dateParam) 
        : DateUtil.getYesterdayJST();
      
      if (isNaN(targetDate.getTime())) {
        logger.error(`Invalid date parameter: ${dateParam}`);
        res.status(400).json({
          success: false,
          error: `Invalid date parameter: ${dateParam}`,
        });
        return;
      }
      
      const formattedDate = DateUtil.formatDate(targetDate, 'YYYY-MM-DD');
      logger.info(`Received ETL request for date: ${formattedDate}`);
      
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
      logger.error('Unexpected error in ETL controller', { error: errorMessage });
      
      res.status(500).json({
        success: false,
        error: errorMessage,
      });
    }
  }
}