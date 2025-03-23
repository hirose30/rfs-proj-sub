import { BigQuery, QueryRowsResponse } from '@google-cloud/bigquery';
import { logger, formatError } from '../util/logger';
import { getCurrentEnvironment } from '../config/environments';

/**
 * BigQueryリポジトリ
 * BigQueryとの通信を担当
 */
export class BigQueryRepository {
  private client: BigQuery;

  constructor() {
    this.client = new BigQuery({
      projectId: getCurrentEnvironment().projectId,
    });
    logger.info('BigQuery client initialized');
  }

  /**
   * SQLクエリを実行
   * @param queryOrOptions 実行するSQLクエリまたはオプション
   * @returns クエリ結果
   */
  async executeQuery(queryOrOptions: string | { query: string; params?: Record<string, any> }): Promise<any[]> {
    try {
      const options = typeof queryOrOptions === 'string'
        ? { query: queryOrOptions }
        : queryOrOptions;
      
      logger.debug(`Executing query: ${options.query}`);
      const [rows] = await this.client.query(options);
      logger.info(`Query executed successfully, returned ${rows?.length || 0} rows`);
      return rows || [];
    } catch (error) {
      logger.error('Failed to execute query', formatError(error));
      throw error;
    }
  }

  /**
   * 特定の日付のデータを削除
   * @param tableName テーブル名
   * @param date 削除対象の日付
   */
  async deleteExistingData(tableName: string, date: Date): Promise<void> {
    const formattedDate = date.toISOString().split('T')[0]; // YYYY-MM-DD形式
    
    const query = `
      DELETE FROM \`${tableName}\`
      WHERE DATE(timestamp_hourly) = '${formattedDate}'
    `;
    
    try {
      logger.info(`Deleting existing data for date: ${formattedDate}`);
      await this.client.query({ query });
      logger.info(`Successfully deleted existing data for date: ${formattedDate}`);
    } catch (error) {
      logger.error(`Failed to delete existing data for date: ${formattedDate}`, formatError(error));
      throw error;
    }
  }

  /**
   * データをテーブルに挿入
   * @param tableName テーブル名
   * @param rows 挿入するデータ行
   * @returns 挿入された行数
   */
  async insertData(tableName: string, rows: any[]): Promise<number> {
    if (!rows || rows.length === 0) {
      logger.warn('No data to insert');
      return 0;
    }
    
    try {
      logger.info(`Inserting ${rows.length} rows into table: ${tableName}`);
      
      // テーブル名からプロジェクトID、データセット名、テーブル名を抽出
      const tableNameParts = tableName.split('.');
      let datasetId, tableId;
      
      if (tableNameParts.length === 3) {
        // プロジェクトID.データセット.テーブル形式
        datasetId = tableNameParts[1];
        tableId = tableNameParts[2];
      } else if (tableNameParts.length === 2) {
        // データセット.テーブル形式
        datasetId = tableNameParts[0];
        tableId = tableNameParts[1];
      } else {
        // テーブル名のみの形式
        datasetId = getCurrentEnvironment().dataset;
        tableId = tableName;
      }
      
      const [response] = await this.client
        .dataset(datasetId)
        .table(tableId)
        .insert(rows);
      
      logger.info(`Successfully inserted data into table: ${tableName}`);
      return rows.length;
    } catch (error) {
      logger.error(`Failed to insert data into table: ${tableName}`, formatError(error));
      throw error;
    }
  }
}