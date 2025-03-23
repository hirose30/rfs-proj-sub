import { ImpQueryBuilder } from '../../src/query/imp.query';

describe('ImpQueryBuilder', () => {
  let queryBuilder: ImpQueryBuilder;

  beforeEach(() => {
    queryBuilder = new ImpQueryBuilder();
  });

  describe('buildImpressionsQuery', () => {
    it('should build a valid SQL query with the correct date', () => {
      const testDate = new Date('2025-03-22');
      const query = queryBuilder.buildImpressionsQuery(testDate);
      
      // クエリに日付が正しく含まれていることを確認
      expect(query).toContain('2025-03-22 00:00:00');
      expect(query).toContain('2025-03-22 23:59:59');
      
      // 必要なカラムが含まれていることを確認
      expect(query).toContain('timestamp_hourly');
      expect(query).toContain('mediumId');
      expect(query).toContain('storeId');
      expect(query).toContain('device_id');
      expect(query).toContain('programId');
      expect(query).toContain('sequence');
      expect(query).toContain('creativeId');
      expect(query).toContain('deliveryId');
      expect(query).toContain('imp');
      expect(query).toContain('cnt');
      
      // 型変換が含まれていることを確認
      expect(query).toContain('CAST(rfs_events.url_parse(httpRequest.requestUrl, \'mediumId\') AS INT64)');
      expect(query).toContain('CAST(rfs_events.url_parse(httpRequest.requestUrl, \'storeId\') AS INT64)');
      
      // 必要な条件が含まれていることを確認
      expect(query).toContain('regexp_extract(httpRequest.requestUrl, \'//[^/]+([^?#]+)\') = \'/tracking\'');
      expect(query).toContain('rfs_events.url_parse(httpRequest.requestUrl, \'event\') = \'complete\'');
      expect(query).toContain('rfs_events.url_parse(httpRequest.requestUrl, \'networkId\') = \'1\'');
      
      // GROUP BYとHAVING句が含まれていることを確認
      expect(query).toContain('GROUP BY');
      expect(query).toContain('HAVING');
      expect(query).toContain('imp > 0');
    });
  });

  describe('buildCreateTableQuery', () => {
    it('should build a valid CREATE TABLE query', () => {
      const tableName = 'project.dataset.table';
      const query = queryBuilder.buildCreateTableQuery(tableName);
      
      // テーブル名が正しく含まれていることを確認
      expect(query).toContain('CREATE TABLE IF NOT EXISTS `project.dataset.table`');
      
      // 必要なカラムが含まれていることを確認
      expect(query).toContain('timestamp_hourly TIMESTAMP');
      expect(query).toContain('mediumId INT64');
      expect(query).toContain('storeId INT64');
      expect(query).toContain('device_id STRING');
      expect(query).toContain('programId INT64');
      expect(query).toContain('sequence INT64');
      expect(query).toContain('creativeId INT64');
      expect(query).toContain('deliveryId INT64');
      expect(query).toContain('imp INT64');
      expect(query).toContain('cnt INT64');
      
      // パーティショニングとクラスタリングが含まれていることを確認
      expect(query).toContain('PARTITION BY DATE(timestamp_hourly)');
      expect(query).toContain('CLUSTER BY mediumId, storeId, creativeId');
    });
  });
});