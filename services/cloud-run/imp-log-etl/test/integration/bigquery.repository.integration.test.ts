/**
 * BigQueryリポジトリの統合テスト
 * 
 * 注意: このテストは実際のBigQueryに接続するため、適切な認証情報が必要です。
 * テスト実行前に、以下の環境変数を設定してください：
 * - GOOGLE_APPLICATION_CREDENTIALS: サービスアカウントキーファイルのパス
 * - TEST_PROJECT_ID: テスト用のプロジェクトID
 * - TEST_DATASET: テスト用のデータセット
 * - TEST_TABLE: テスト用のテーブル
 * 
 * テストを実行するには：
 * RUN_INTEGRATION_TESTS=true npm test -- bigquery.repository.integration.test.ts
 */

import { BigQueryRepository } from '../../src/repository/bigquery.repository';

// 統合テストを実行するかどうかを環境変数で制御
const runIntegrationTests = process.env.RUN_INTEGRATION_TESTS === 'true';

// 統合テストをスキップするかどうかを決定
const describeOrSkip = runIntegrationTests ? describe : describe.skip;

describeOrSkip('BigQueryRepository (Integration)', () => {
  let repository: BigQueryRepository;
  const testProjectId = process.env.TEST_PROJECT_ID || 'test-project';
  const testDataset = process.env.TEST_DATASET || 'test_dataset';
  const testTable = process.env.TEST_TABLE || 'test_table';
  const fullTableName = `${testProjectId}.${testDataset}.${testTable}`;
  
  beforeAll(() => {
    // 環境変数の確認
    if (runIntegrationTests) {
      if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        console.warn('GOOGLE_APPLICATION_CREDENTIALS環境変数が設定されていません。デフォルトの認証情報を使用します。');
      }
      
      console.log(`テスト対象のテーブル: ${fullTableName}`);
    }
  });
  
  beforeEach(() => {
    repository = new BigQueryRepository();
  });
  
  describe('executeQuery', () => {
    it('should execute a simple query', async () => {
      // シンプルなクエリを実行
      const query = 'SELECT 1 as value';
      const result = await repository.executeQuery(query);
      
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(1);
      expect(result[0].value).toBe(1);
    });
    
    it('should handle query with parameters', async () => {
      // パラメータを含むクエリを実行
      const query = `
        SELECT
          @value as test_value,
          @text as test_text
      `;
      
      const options = {
        query,
        params: {
          value: 42,
          text: 'test'
        }
      };
      
      // executeQueryメソッドの引数の型に合わせる
      const result = await repository.executeQuery(options as any);
      
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(1);
      expect(result[0].test_value).toBe(42);
      expect(result[0].test_text).toBe('test');
    });
  });
  
  describe('Table operations', () => {
    const testDate = new Date('2025-03-22');
    const testTableId = `test_table_${Date.now()}`;
    const tempFullTableName = `${testProjectId}.${testDataset}.${testTableId}`;
    
    // テスト用のテーブルを作成
    beforeAll(async () => {
      if (runIntegrationTests) {
        try {
          const createTableQuery = `
            CREATE TABLE IF NOT EXISTS \`${tempFullTableName}\` (
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
          `;
          
          await repository.executeQuery(createTableQuery);
          console.log(`テストテーブルを作成しました: ${tempFullTableName}`);
        } catch (error) {
          console.error('テストテーブルの作成に失敗しました:', error);
          throw error;
        }
      }
    });
    
    // テスト後にテーブルをクリーンアップ
    afterAll(async () => {
      if (runIntegrationTests) {
        try {
          const dropTableQuery = `DROP TABLE IF EXISTS \`${tempFullTableName}\``;
          await repository.executeQuery(dropTableQuery);
          console.log(`テストテーブルを削除しました: ${tempFullTableName}`);
        } catch (error) {
          console.error('テストテーブルの削除に失敗しました:', error);
        }
      }
    });
    
    it('should insert data and verify count', async () => {
      // テストデータ
      const testData = [
        {
          timestamp_hourly: new Date('2025-03-22T19:00:00Z'),
          mediumId: 2,
          storeId: 618,
          device_id: '36b05fbe-c2e2dcde',
          programId: 90,
          sequence: 11,
          creativeId: 245,
          deliveryId: 1314,
          imp: 19,
          cnt: 19
        },
        {
          timestamp_hourly: new Date('2025-03-22T20:00:00Z'),
          mediumId: 7,
          storeId: 585,
          device_id: '91e158a7-dec70a8',
          programId: 59,
          sequence: 9,
          creativeId: 152,
          deliveryId: 1425,
          imp: 17,
          cnt: 17
        }
      ];
      
      // データを挿入
      await repository.insertData(tempFullTableName, testData);
      
      // データが挿入されたことを確認
      const checkQuery = `SELECT COUNT(*) as count FROM \`${tempFullTableName}\` WHERE DATE(timestamp_hourly) = '2025-03-22'`;
      const result = await repository.executeQuery(checkQuery);
      
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(1);
      expect(result[0].count).toBe(2);
      
      // ストリーミングバッファの制限を回避するため、DELETEの代わりにテーブルを再作成
      const recreateTableQuery = `
        CREATE OR REPLACE TABLE \`${tempFullTableName}\` (
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
      `;
      
      await repository.executeQuery(recreateTableQuery);
      
      // テーブルが空になったことを確認
      const afterRecreateResult = await repository.executeQuery(checkQuery);
      
      expect(afterRecreateResult).toBeDefined();
      expect(Array.isArray(afterRecreateResult)).toBe(true);
      expect(afterRecreateResult.length).toBe(1);
      expect(afterRecreateResult[0].count).toBe(0);
    });
  });
});