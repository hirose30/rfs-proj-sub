import { BigQueryRepository } from '../repository/bigquery.repository';
import { ImpQueryBuilder } from '../query/imp.query';
import { logger, formatError } from '../util/logger';
import { getFullyQualifiedTableName } from '../config/environments';
import { DateUtil } from '../util/date.util';

/**
 * ETL処理の結果インターフェース
 */
export interface ETLResponse {
  success: boolean;
  processedDate: Date;
  rowCount?: number;
  error?: string;
}

/**
 * 日付範囲ETL処理の結果インターフェース
 */
export interface DateRangeETLResponse {
  success: boolean;
  startDate: Date;
  endDate: Date;
  results: ETLResponse[];
  totalRowCount: number;
  failedDates?: Date[];
}

/**
 * ETLサービス
 * データの抽出、変換、ロードを担当
 */
export class EtlService {
  private bigQueryRepository: BigQueryRepository;
  private queryBuilder: ImpQueryBuilder;

  constructor() {
    this.bigQueryRepository = new BigQueryRepository();
    this.queryBuilder = new ImpQueryBuilder();
  }

  /**
   * 指定された日付範囲のデータを処理
   * @param startDate 開始日
   * @param endDate 終了日
   * @returns 処理結果
   */
  async processDateRange(startDate: Date, endDate: Date): Promise<DateRangeETLResponse> {
    const formattedStartDate = DateUtil.formatDate(startDate, 'YYYY-MM-DD');
    const formattedEndDate = DateUtil.formatDate(endDate, 'YYYY-MM-DD');
    logger.info(`Starting ETL process for date range: ${formattedStartDate} to ${formattedEndDate}`);
    
    // 日付範囲を生成
    const dateRange = DateUtil.generateDateRange(startDate, endDate);
    
    // 各日付に対して処理を実行
    const results: ETLResponse[] = [];
    const failedDates: Date[] = [];
    let totalRowCount = 0;
    
    for (const date of dateRange) {
      const formattedDate = DateUtil.formatDate(date, 'YYYY-MM-DD');
      logger.info(`Processing date: ${formattedDate}`);
      
      try {
        const result = await this.process(date);
        results.push(result);
        
        if (result.success) {
          totalRowCount += result.rowCount || 0;
        } else {
          failedDates.push(date);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(`Failed to process data for date: ${formattedDate}`, formatError(error));
        
        results.push({
          success: false,
          processedDate: date,
          error: errorMessage,
        });
        
        failedDates.push(date);
      }
    }
    
    const success = failedDates.length === 0;
    
    if (success) {
      logger.info(`Successfully processed all dates from ${formattedStartDate} to ${formattedEndDate}`);
      logger.info(`Total rows processed: ${totalRowCount}`);
    } else {
      logger.warn(`Completed with errors. ${failedDates.length} dates failed out of ${dateRange.length}`);
    }
    
    return {
      success,
      startDate,
      endDate,
      results,
      totalRowCount,
      failedDates: failedDates.length > 0 ? failedDates : undefined,
    };
  }

  /**
   * 指定された日付のデータを処理
   * @param date 処理対象の日付
   * @returns 処理結果
   */
  async process(date: Date): Promise<ETLResponse> {
    const formattedDate = DateUtil.formatDate(date, 'YYYY-MM-DD');
    logger.info(`Starting ETL process for date: ${formattedDate}`);
    
    try {
      // テーブルが存在することを確認
      await this.ensureTableExists();
      
      // 既存データを削除
      const tableName = getFullyQualifiedTableName();
      await this.bigQueryRepository.deleteExistingData(tableName, date);
      
      // クエリを構築
      const query = this.queryBuilder.buildImpressionsQuery(date);
      
      // クエリを実行し、結果を直接テーブルに書き込む
      const rowCount = await this.bigQueryRepository.executeQueryAndWriteToTable(query, tableName, date);
      
      if (rowCount === 0) {
        logger.info(`No data found for date: ${formattedDate}`);
      } else {
        logger.info(`Successfully processed a total of ${rowCount} rows for date: ${formattedDate}`);
      }
      
      return {
        success: true,
        processedDate: date,
        rowCount,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to process data for date: ${formattedDate}`, formatError(error));
      
      return {
        success: false,
        processedDate: date,
        error: errorMessage,
      };
    }
  }

  /**
   * テーブルが存在することを確認し、存在しない場合は作成
   */
  private async ensureTableExists(): Promise<void> {
    try {
      const tableName = getFullyQualifiedTableName();
      const createTableQuery = this.queryBuilder.buildCreateTableQuery(tableName);
      
      logger.info(`Ensuring table exists: ${tableName}`);
      await this.bigQueryRepository.executeQuery(createTableQuery);
      logger.info(`Table confirmed: ${tableName}`);
    } catch (error) {
      logger.error('Failed to ensure table exists', formatError(error));
      throw error;
    }
  }
}