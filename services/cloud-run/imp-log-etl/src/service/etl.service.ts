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
      
      // クエリを構築して実行
      const query = this.queryBuilder.buildImpressionsQuery(date);
      const results = await this.bigQueryRepository.executeQuery(query);
      
      if (results.length === 0) {
        logger.info(`No data found for date: ${formattedDate}`);
        return {
          success: true,
          processedDate: date,
          rowCount: 0,
        };
      }
      
      // 既存データを削除
      const tableName = getFullyQualifiedTableName();
      await this.bigQueryRepository.deleteExistingData(tableName, date);
      
      // 新データを挿入
      const rowCount = await this.bigQueryRepository.insertData(tableName, results);
      
      logger.info(`Successfully processed ${rowCount} rows for date: ${formattedDate}`);
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