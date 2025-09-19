import { ReprocessController } from '../../src/controller/reprocess.controller';
import { EtlService } from '../../src/service/etl.service';
import { createMockRequest, createMockResponse } from '../helpers/mocks';
import { DateUtil } from '../../src/util/date.util';

// モックの設定
jest.mock('../../src/service/etl.service');
jest.mock('../../src/util/date.util');

describe('ReprocessController', () => {
  let controller: ReprocessController;
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
    jest.spyOn(DateUtil, 'isValidDate').mockImplementation((dateStr: string) => {
      return /^\d{4}-\d{2}-\d{2}$/.test(dateStr) && !isNaN(new Date(dateStr).getTime());
    });
    
    // コントローラーのインスタンス化
    controller = new ReprocessController();
  });
  
  describe('reprocessDate', () => {
    it('should process data for the specified date', async () => {
      // リクエストとレスポンスのモック
      const req = createMockRequest({
        body: { date: '2025-03-20' }
      });
      const res = createMockResponse();
      
      // 成功レスポンスをモック
      mockEtlService.process.mockResolvedValue({
        success: true,
        processedDate: new Date('2025-03-20'),
        rowCount: 5
      });
      
      // コントローラーメソッドを呼び出し
      await controller.reprocessDate(req, res);
      
      // 日付の妥当性が検証されたことを確認
      expect(DateUtil.isValidDate).toHaveBeenCalledWith('2025-03-20');
      
      // 指定された日付でETLサービスが呼び出されたことを確認
      expect(mockEtlService.process).toHaveBeenCalledWith(new Date('2025-03-20'));
      
      // 正しいレスポンスが返されたことを確認
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        processedDate: new Date('2025-03-20'),
        rowCount: 5
      });
    });
    
    it('should handle missing date parameter', async () => {
      // 日付パラメータがないリクエストのモック
      const req = createMockRequest({
        body: {}
      });
      const res = createMockResponse();
      
      // コントローラーメソッドを呼び出し
      await controller.reprocessDate(req, res);
      
      // ETLサービスが呼び出されないことを確認
      expect(mockEtlService.process).not.toHaveBeenCalled();
      
      // エラーレスポンスが返されたことを確認
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Missing date parameter in request body'
      });
    });
    
    it('should handle invalid date format', async () => {
      // 無効な日付フォーマットのリクエストのモック
      const req = createMockRequest({
        body: { date: '2025/03/20' }
      });
      const res = createMockResponse();
      
      // 無効な日付を模擬
      jest.spyOn(DateUtil, 'isValidDate').mockReturnValue(false);
      
      // コントローラーメソッドを呼び出し
      await controller.reprocessDate(req, res);
      
      // ETLサービスが呼び出されないことを確認
      expect(mockEtlService.process).not.toHaveBeenCalled();
      
      // エラーレスポンスが返されたことを確認
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid date format: 2025/03/20. Expected format: YYYY-MM-DD'
      });
    });
    
    it('should handle ETL processing errors', async () => {
      // リクエストとレスポンスのモック
      const req = createMockRequest({
        body: { date: '2025-03-20' }
      });
      const res = createMockResponse();
      
      // エラーレスポンスをモック
      mockEtlService.process.mockResolvedValue({
        success: false,
        processedDate: new Date('2025-03-20'),
        error: 'Processing failed'
      });
      
      // コントローラーメソッドを呼び出し
      await controller.reprocessDate(req, res);
      
      // 正しいレスポンスが返されたことを確認
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        processedDate: new Date('2025-03-20'),
        error: 'Processing failed'
      });
    });
    
    it('should handle unexpected errors', async () => {
      // リクエストとレスポンスのモック
      const req = createMockRequest({
        body: { date: '2025-03-20' }
      });
      const res = createMockResponse();
      
      // 例外をモック
      mockEtlService.process.mockRejectedValue(new Error('Unexpected error'));
      
      // コントローラーメソッドを呼び出し
      await controller.reprocessDate(req, res);
      
      // エラーレスポンスが返されたことを確認
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Unexpected error'
      });
    });
  });
});