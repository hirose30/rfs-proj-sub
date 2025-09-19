import { Request, Response } from 'express';
import { EtlService, ETLResponse, DateRangeETLResponse } from '../service/etl.service';
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
   * 指定された日付範囲のETL処理を実行
   * @param req HTTPリクエスト
   * @param res HTTPレスポンス
   */
  async runEtlDateRange(req: Request, res: Response): Promise<void> {
    try {
      // リクエストから日付範囲パラメータを取得
      const startDateParam = req.query.startDate as string;
      const endDateParam = req.query.endDate as string || startDateParam; // 終了日が指定されていない場合は開始日と同じ
      
      // 日付パラメータのバリデーション
      if (!startDateParam) {
        logger.error('Missing startDate parameter');
        res.status(400).json({
          success: false,
          error: 'Missing startDate parameter',
        });
        return;
      }
      
      const startDate = new Date(startDateParam);
      const endDate = new Date(endDateParam);
      
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        logger.error(`Invalid date parameters: startDate=${startDateParam}, endDate=${endDateParam}`);
        res.status(400).json({
          success: false,
          error: `Invalid date parameters: startDate=${startDateParam}, endDate=${endDateParam}`,
        });
        return;
      }
      
      if (startDate > endDate) {
        logger.error(`Start date (${startDateParam}) is after end date (${endDateParam})`);
        res.status(400).json({
          success: false,
          error: `Start date (${startDateParam}) is after end date (${endDateParam})`,
        });
        return;
      }
      
      const formattedStartDate = DateUtil.formatDate(startDate, 'YYYY-MM-DD');
      const formattedEndDate = DateUtil.formatDate(endDate, 'YYYY-MM-DD');
      logger.info(`Received ETL request for date range: ${formattedStartDate} to ${formattedEndDate}`);
      
      // ETL処理を実行
      const result = await this.etlService.processDateRange(startDate, endDate);
      
      // 結果に応じてレスポンスを返す
      if (result.success) {
        res.status(200).json(result);
      } else {
        // 一部の日付が失敗した場合は部分的な成功として207（Multi-Status）を返す
        res.status(207).json(result);
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