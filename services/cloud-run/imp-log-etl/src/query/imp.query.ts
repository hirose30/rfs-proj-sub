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
   * @param startHour 開始時間（0-23）
   * @param endHour 終了時間（0-23）
   * @returns SQLクエリ文字列
   */
  buildImpressionsQuery(targetDate: Date, startHour: number = 0, endHour: number = 23, defaultOpeningTime: string = '09:00', defaultClosingTime: string = '21:00'): string {
    const formattedDate = DateUtil.formatDate(targetDate, 'YYYY-MM-DD');
    const formattedStartHour = startHour.toString().padStart(2, '0');
    const formattedEndHour = endHour.toString().padStart(2, '0');
    
    logger.debug(`Building query for date: ${formattedDate}, hours: ${formattedStartHour}-${formattedEndHour}`);
    
    return `
    SELECT
      TIMESTAMP(FORMAT_TIMESTAMP('%Y-%m-%d %H:00:00', timestamp, 'Asia/Tokyo'), 'Asia/Tokyo') AS timestamp_hourly,
      SAFE_CAST(rfs_events.url_parse(httpRequest.requestUrl, 'mediumId') AS INT64) as mediumId,
      SAFE_CAST(rfs_events.url_parse(httpRequest.requestUrl, 'storeId') AS INT64) as storeId,
      rfs_events.url_parse(httpRequest.requestUrl, 'device_id') as device_id,
      SAFE_CAST(rfs_events.url_parse(httpRequest.requestUrl, 'programId') AS INT64) as programId,
      SAFE_CAST(rfs_events.url_parse(httpRequest.requestUrl, 'sequence') AS INT64) as sequence,
      SAFE_CAST(rfs_events.url_parse(httpRequest.requestUrl, 'creativeId') AS INT64) as creativeId,
      SAFE_CAST(rfs_events.url_parse(httpRequest.requestUrl, 'deliveryId') AS INT64) as deliveryId,
      SUM(CASE WHEN FORMAT_TIMESTAMP('%H:%M', timestamp, 'Asia/Tokyo') >= COALESCE(NULLIF(signage.opening_time, ''), '${defaultOpeningTime}')
            AND FORMAT_TIMESTAMP('%H:%M', timestamp, 'Asia/Tokyo') < COALESCE(NULLIF(signage.closing_time, ''), '${defaultClosingTime}')
            THEN 1 ELSE 0 END) as imp,
      COUNT(1) cnt
    FROM
      rfs_events.requests req
    LEFT JOIN
      sg_reports_tmp.signage_imported_temp signage
    ON
      rfs_events.url_parse(httpRequest.requestUrl, 'device_id') = signage.fully_device_id
    WHERE
      regexp_extract(httpRequest.requestUrl, '//[^/]+([^?#]+)') = '/tracking'
      AND rfs_events.url_parse(httpRequest.requestUrl, 'event') = 'complete'
      AND rfs_events.url_parse(httpRequest.requestUrl, 'send_ts') != ''
      AND TIMESTAMP_ADD(TIMESTAMP, INTERVAL 9 HOUR) BETWEEN "${formattedDate} ${formattedStartHour}:00:00" AND "${formattedDate} ${formattedEndHour}:59:59"
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