import { EtlController } from '../../src/controller/etl.controller';
import { EtlService } from '../../src/service/etl.service';
import { createMockRequest, createMockResponse } from '../helpers/mocks';
import { DateUtil } from '../../src/util/date.util';

// モックの設定
jest.mock('../../src/service/etl.service');
jest.mock('../../src/util/date.util');

describe('EtlController', () => {
  let controller: EtlController;
  let mockEtlService: jest.Mocked<EtlService>;
  
  beforeEach(() => {
    // モックをリセット
    jest.clearAllMocks();
    
    // ETLサービスのモック
    mockEtlService = {
      process: jest.fn()
    } as unknown as jest.Mocked<EtlService>;
    (EtlService as jest.Mock).mockImplementation(() => mockEtlService);
    
    // DateUtilのモック
    jest.spyOn(DateUtil, 'getYesterdayJST').mockReturnValue(new Date('2025-03-22'));
    
    // コントローラーのインスタンス化
    controller = new EtlController();
  });
  
  describe('runEtl', () => {
    it('should process data for yesterday when no date is provided', async () => {
      // リクエストとレスポンスのモック
      const req = createMockRequest();
      const res = createMockResponse();
      
      // 成功レスポンスをモック
      mockEtlService.process.mockResolvedValue({
        success: true,
        processedDate: new Date('2025-03-22'),
        rowCount: 3
      });
      
      // コントローラーメソッドを呼び出し
      await controller.runEtl(req, res);
      
      // 前日の日付でETLサービスが呼び出されたことを確認
      expect(DateUtil.getYesterdayJST).toHaveBeenCalled();
      expect(mockEtlService.process).toHaveBeenCalledWith(new Date('2025-03-22'));
      
      // 正しいレスポンスが返されたことを確認
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        processedDate: new Date('2025-03-22'),
        rowCount: 3
      });
    });
    
    it('should process data for the specified date', async () => {
      // 日付パラメータを含むリクエストのモック
      const req = createMockRequest({
        query: { date: '2025-03-20' }
      });
      const res = createMockResponse();
      
      // 成功レスポンスをモック
      mockEtlService.process.mockResolvedValue({
        success: true,
        processedDate: new Date('2025-03-20'),
        rowCount: 5
      });
      
      // コントローラーメソッドを呼び出し
      await controller.runEtl(req, res);
      
      // 指定された日付でETLサービスが呼び出されたことを確認
      expect(DateUtil.getYesterdayJST).not.toHaveBeenCalled();
      expect(mockEtlService.process).toHaveBeenCalledWith(new Date('2025-03-20'));
      
      // 正しいレスポンスが返されたことを確認
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        processedDate: new Date('2025-03-20'),
        rowCount: 5
      });
    });
    
    it('should handle invalid date parameter', async () => {
      // 無効な日付パラメータを含むリクエストのモック
      const req = createMockRequest({
        query: { date: 'invalid-date' }
      });
      const res = createMockResponse();
      
      // コントローラーメソッドを呼び出し
      await controller.runEtl(req, res);
      
      // ETLサービスが呼び出されないことを確認
      expect(mockEtlService.process).not.toHaveBeenCalled();
      
      // エラーレスポンスが返されたことを確認
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid date parameter: invalid-date'
      });
    });
    
    it('should handle ETL processing errors', async () => {
      // リクエストとレスポンスのモック
      const req = createMockRequest();
      const res = createMockResponse();
      
      // エラーレスポンスをモック
      mockEtlService.process.mockResolvedValue({
        success: false,
        processedDate: new Date('2025-03-22'),
        error: 'Processing failed'
      });
      
      // コントローラーメソッドを呼び出し
      await controller.runEtl(req, res);
      
      // 正しいレスポンスが返されたことを確認
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        processedDate: new Date('2025-03-22'),
        error: 'Processing failed'
      });
    });
    
    it('should handle unexpected errors', async () => {
      // リクエストとレスポンスのモック
      const req = createMockRequest();
      const res = createMockResponse();
      
      // 例外をモック
      mockEtlService.process.mockRejectedValue(new Error('Unexpected error'));
      
      // コントローラーメソッドを呼び出し
      await controller.runEtl(req, res);
      
      // エラーレスポンスが返されたことを確認
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Unexpected error'
      });
    });
  });
});