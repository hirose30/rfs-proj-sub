import { EtlService } from '../../src/service/etl.service';
import { BigQueryRepository } from '../../src/repository/bigquery.repository';
import { ImpQueryBuilder } from '../../src/query/imp.query';
import { mockBigQueryResponse, MockBigQueryRepository } from '../helpers/mocks';
import * as environments from '../../src/config/environments';

// モックの設定
jest.mock('../../src/repository/bigquery.repository');
jest.mock('../../src/query/imp.query');
jest.mock('../../src/config/environments');

describe('EtlService', () => {
  let etlService: EtlService;
  let mockBigQueryRepository: jest.Mocked<BigQueryRepository>;
  let mockQueryBuilder: jest.Mocked<ImpQueryBuilder>;
  
  beforeEach(() => {
    // モックをリセット
    jest.clearAllMocks();
    
    // モックの実装
    mockBigQueryRepository = new MockBigQueryRepository() as unknown as jest.Mocked<BigQueryRepository>;
    (BigQueryRepository as jest.Mock).mockImplementation(() => mockBigQueryRepository);
    
    mockQueryBuilder = {
      buildImpressionsQuery: jest.fn().mockReturnValue('MOCK SQL QUERY'),
      buildCreateTableQuery: jest.fn().mockReturnValue('MOCK CREATE TABLE QUERY')
    } as unknown as jest.Mocked<ImpQueryBuilder>;
    (ImpQueryBuilder as jest.Mock).mockImplementation(() => mockQueryBuilder);
    
    // 環境設定のモック
    jest.spyOn(environments, 'getFullyQualifiedTableName').mockReturnValue('project.dataset.table');
    
    // サービスのインスタンス化
    etlService = new EtlService();
  });
  
  describe('process', () => {
    it('should process data successfully', async () => {
      const testDate = new Date('2025-03-22');
      
      const result = await etlService.process(testDate);
      
      // クエリが正しく構築されたことを確認
      expect(mockQueryBuilder.buildImpressionsQuery).toHaveBeenCalledWith(testDate);
      expect(mockQueryBuilder.buildCreateTableQuery).toHaveBeenCalledWith('project.dataset.table');
      
      // BigQueryリポジトリのメソッドが正しく呼び出されたことを確認
      expect(mockBigQueryRepository.executeQuery).toHaveBeenCalledTimes(2);
      expect(mockBigQueryRepository.executeQuery).toHaveBeenCalledWith('MOCK CREATE TABLE QUERY');
      expect(mockBigQueryRepository.executeQuery).toHaveBeenCalledWith('MOCK SQL QUERY');
      
      expect(mockBigQueryRepository.deleteExistingData).toHaveBeenCalledWith('project.dataset.table', testDate);
      expect(mockBigQueryRepository.insertData).toHaveBeenCalledWith('project.dataset.table', mockBigQueryResponse);
      
      // 結果が正しいことを確認
      expect(result).toEqual({
        success: true,
        processedDate: testDate,
        rowCount: mockBigQueryResponse.length
      });
    });
    
    it('should handle empty query results', async () => {
      const testDate = new Date('2025-03-22');
      
      // 空の結果をモック
      mockBigQueryRepository.executeQuery.mockResolvedValueOnce([]); // テーブル作成クエリ
      mockBigQueryRepository.executeQuery.mockResolvedValueOnce([]); // データクエリ
      
      const result = await etlService.process(testDate);
      
      // データが空の場合、deleteとinsertは呼ばれないはず
      expect(mockBigQueryRepository.deleteExistingData).not.toHaveBeenCalled();
      expect(mockBigQueryRepository.insertData).not.toHaveBeenCalled();
      
      // 結果が正しいことを確認
      expect(result).toEqual({
        success: true,
        processedDate: testDate,
        rowCount: 0
      });
    });
    
    it('should handle errors during processing', async () => {
      const testDate = new Date('2025-03-22');
      const testError = new Error('Test error');
      
      // エラーをモック
      mockBigQueryRepository.executeQuery.mockRejectedValueOnce(testError);
      
      const result = await etlService.process(testDate);
      
      // エラーが正しく処理されたことを確認
      expect(result).toEqual({
        success: false,
        processedDate: testDate,
        error: 'Test error'
      });
    });
  });
});