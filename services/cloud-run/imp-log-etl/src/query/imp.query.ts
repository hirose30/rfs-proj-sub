import { DateUtil } from '../util/date.util';
import { logger } from '../util/logger';

/**
 * インプレッションクエリビルダー
 * BigQueryに対するSQLクエリを構築
 */
export class ImpQueryBuilder {
  /**
   * インプレッションデータを集計するクエリを構築
   * @param targetDate 対象日付
   * @returns SQLクエリ文字列
   */
  buildImpressionsQuery(targetDate: Date): string {
    const formattedDate = DateUtil.formatDate(targetDate, 'YYYY-MM-DD');
    logger.debug(`Building query for date: ${formattedDate}`);
    
    return `
    DECLARE default_opening_time STRING DEFAULT "09:00";
    DECLARE default_closing_time STRING DEFAULT "21:00";
    
    SELECT
      FORMAT_TIMESTAMP('%Y-%m-%d %H:00:00', timestamp, 'Asia/Tokyo') AS timestamp_hourly,
      CAST(rfs_events.url_parse(httpRequest.requestUrl, 'mediumId') AS INT64) as mediumId,
      CAST(rfs_events.url_parse(httpRequest.requestUrl, 'storeId') AS INT64) as storeId,
      rfs_events.url_parse(httpRequest.requestUrl, 'device_id') as device_id,
      CAST(rfs_events.url_parse(httpRequest.requestUrl, 'programId') AS INT64) as programId,
      CAST(rfs_events.url_parse(httpRequest.requestUrl, 'sequence') AS INT64) as sequence,
      CAST(rfs_events.url_parse(httpRequest.requestUrl, 'creativeId') AS INT64) as creativeId,
      CAST(rfs_events.url_parse(httpRequest.requestUrl, 'deliveryId') AS INT64) as deliveryId,
      SUM(CASE WHEN FORMAT_TIMESTAMP('%H:%M', timestamp, 'Asia/Tokyo') >= COALESCE(NULLIF(signage.opening_time, ''), default_opening_time) 
            AND FORMAT_TIMESTAMP('%H:%M', timestamp, 'Asia/Tokyo') < COALESCE(NULLIF(signage.closing_time, ''), default_closing_time) 
            THEN 1 ELSE 0 END) as imp,
      COUNT(1) cnt
    FROM
      rfs_events.requests req
    LEFT JOIN 
      rfs_spreadsheet.signage signage 
    ON 
      rfs_events.url_parse(httpRequest.requestUrl, 'device_id') = signage.fully_device_id
    WHERE
      regexp_extract(httpRequest.requestUrl, '//[^/]+([^?#]+)') = '/tracking'
      AND rfs_events.url_parse(httpRequest.requestUrl, 'event') = 'complete'
      AND rfs_events.url_parse(httpRequest.requestUrl, 'send_ts') != ''
      AND TIMESTAMP_ADD(TIMESTAMP, INTERVAL 9 HOUR) BETWEEN "${formattedDate} 00:00:00" AND "${formattedDate} 23:59:59"
      AND rfs_events.url_parse(httpRequest.requestUrl, 'networkId') = '1'
    GROUP BY 
      timestamp_hourly, mediumId, storeId, device_id, programId, sequence, creativeId, deliveryId
    HAVING 
      imp > 0
    `;
  }

  /**
   * テーブルスキーマを作成するDDLクエリを構築
   * @param tableName テーブル名
   * @returns DDLクエリ文字列
   */
  buildCreateTableQuery(tableName: string): string {
    return `
    CREATE TABLE IF NOT EXISTS \`${tableName}\` (
      timestamp_hourly TIMESTAMP,
      mediumId INT64,
      storeId INT64,
      device_id STRING,
      programId INT64,
      sequence INT64,
      creativeId INT64,
      deliveryId INT64,
      imp INT64,
      cnt INT64
    )
    PARTITION BY DATE(timestamp_hourly)
    CLUSTER BY mediumId, storeId, creativeId
    `;
  }
}