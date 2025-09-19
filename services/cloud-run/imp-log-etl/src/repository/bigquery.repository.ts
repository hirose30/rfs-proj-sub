import { BigQuery, QueryRowsResponse } from '@google-cloud/bigquery';
import { Storage } from '@google-cloud/storage';
import { logger, formatError } from '../util/logger';
import { getCurrentEnvironment } from '../config/environments';
import { v4 as uuidv4 } from 'uuid';

/**
 * BigQueryリポジトリ
 * BigQueryとの通信を担当
 */
export class BigQueryRepository {
  private client: BigQuery;
  private storage: Storage;
  private bucketName: string;

  constructor() {
    const projectId = getCurrentEnvironment().projectId;
    this.client = new BigQuery({
      projectId,
    });
    this.storage = new Storage({
      projectId,
    });
    this.bucketName = `${projectId}-etl-temp`;
    logger.info('BigQuery client initialized');
  }

  /**
   * バケットが存在することを確認し、存在しない場合は作成
   */
  private async ensureBucketExists(): Promise<void> {
    try {
      const [exists] = await this.storage.bucket(this.bucketName).exists();
      if (!exists) {
        logger.info(`Creating bucket: ${this.bucketName}`);
        await this.storage.createBucket(this.bucketName, {
          location: 'asia-northeast1',
          storageClass: 'STANDARD',
        });
        logger.info(`Bucket created: ${this.bucketName}`);
      }
    } catch (error) {
      logger.error('Failed to ensure bucket exists', formatError(error));
      throw error;
    }
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
   * クエリ結果を一時テーブル経由でテーブルに書き込む
   * @param query 実行するSQLクエリ
   * @param destinationTable 書き込み先テーブル名
   * @param date 対象日付
   * @returns 処理された行数
   */
  async executeQueryAndWriteToTable(query: string, destinationTable: string, date: Date): Promise<number> {
    try {
      const formattedDate = date.toISOString().split('T')[0]; // YYYY-MM-DD形式
      const tempTableId = `temp_${formattedDate.replace(/-/g, '')}_${uuidv4().substring(0, 8)}`;
      
      // テーブル名からプロジェクトID、データセット名、テーブル名を抽出
      const tableNameParts = destinationTable.split('.');
      let projectId = getCurrentEnvironment().projectId;
      let datasetId, tableId;
      
      if (tableNameParts.length === 3) {
        // プロジェクトID.データセット.テーブル形式
        projectId = tableNameParts[0];
        datasetId = tableNameParts[1];
        tableId = tableNameParts[2];
      } else if (tableNameParts.length === 2) {
        // データセット.テーブル形式
        datasetId = tableNameParts[0];
        tableId = tableNameParts[1];
      } else {
        // テーブル名のみの形式
        datasetId = getCurrentEnvironment().dataset;
        tableId = destinationTable;
      }
      
      // 一時テーブルの完全修飾名
      const tempTableFullName = `${projectId}.${datasetId}.${tempTableId}`;
      
      logger.info(`Creating temporary table: ${tempTableFullName}`);
      
      // 一時テーブルを作成するクエリ
      const createTempTableQuery = `
        CREATE OR REPLACE TABLE \`${tempTableFullName}\` AS
        ${query}
      `;
      
      // 一時テーブルを作成
      logger.info(`Executing query to create temporary table for date: ${formattedDate}`);
      await this.client.query({ query: createTempTableQuery });
      
      // 一時テーブルからデータを取得して行数をカウント
      logger.info(`Counting rows in temporary table: ${tempTableFullName}`);
      const [countResult] = await this.client.query({
        query: `SELECT COUNT(*) as count FROM \`${tempTableFullName}\``
      });
      
      const rowCount = countResult[0].count;
      
      if (rowCount === 0) {
        logger.info(`No data found in temporary table for date: ${formattedDate}`);
        
        // 一時テーブルを削除
        logger.info(`Cleaning up temporary table: ${tempTableFullName}`);
        await this.client.query({
          query: `DROP TABLE IF EXISTS \`${tempTableFullName}\``
        });
        
        return 0;
      }
      
      logger.info(`Found ${rowCount} rows in temporary table`);
      
      // 特定の日付のデータを削除（deleteExistingDataメソッドと同様の処理）
      logger.info(`Deleting existing data for date: ${formattedDate} from ${destinationTable}`);
      await this.client.query({
        query: `DELETE FROM \`${destinationTable}\` WHERE DATE(timestamp_hourly) = '${formattedDate}'`
      });
      
      // 一時テーブルからデータを目的のテーブルに挿入
      logger.info(`Inserting data from temporary table to ${destinationTable}`);
      await this.client.query({
        query: `INSERT INTO \`${destinationTable}\` SELECT * FROM \`${tempTableFullName}\``
      });
      
      // 一時テーブルを削除
      logger.info(`Cleaning up temporary table: ${tempTableFullName}`);
      await this.client.query({
        query: `DROP TABLE IF EXISTS \`${tempTableFullName}\``
      });
      
      logger.info(`Successfully processed ${rowCount} rows for date: ${formattedDate}`);
      
      return rowCount;
    } catch (error) {
      logger.error(`Failed to execute query and write to table: ${destinationTable}`, formatError(error));
      throw error;
    }
  }

  /**
   * データをテーブルに挿入（非推奨：大量データの場合はexportQueryResultToStorage + loadDataFromStorageを使用）
   * @param tableName テーブル名
   * @param rows 挿入するデータ行
   * @returns 挿入された行数
   * @deprecated 大量データの場合はexportQueryResultToStorage + loadDataFromStorageを使用
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