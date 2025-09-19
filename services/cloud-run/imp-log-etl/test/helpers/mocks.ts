/**
 * テスト用のモックとヘルパー関数
 */
import { jest } from '@jest/globals';

// グローバルオブジェクトの型定義
declare const global: {
  Date: DateConstructor;
  [key: string]: any;
};

/**
 * モックBigQueryレスポンス
 */
export const mockBigQueryResponse = [
  {
    timestamp_hourly: '2025-03-22 19:00:00',
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
    timestamp_hourly: '2025-03-22 20:00:00',
    mediumId: 7,
    storeId: 585,
    device_id: '91e158a7-dec70a8',
    programId: 59,
    sequence: 9,
    creativeId: 152,
    deliveryId: 1425,
    imp: 17,
    cnt: 17
  },
  {
    timestamp_hourly: '2025-03-22 20:00:00',
    mediumId: 1,
    storeId: 903,
    device_id: '91e7a61b-dec70a8',
    programId: 85,
    sequence: 7,
    creativeId: 330,
    deliveryId: 1364,
    imp: 18,
    cnt: 18
  }
];

/**
 * モックBigQueryリポジトリ
 */
export class MockBigQueryRepository {
  executeQuery = (jest.fn() as any).mockResolvedValue(mockBigQueryResponse);
  deleteExistingData = (jest.fn() as any).mockResolvedValue(undefined);
  insertData = (jest.fn() as any).mockResolvedValue(mockBigQueryResponse.length);
}

/**
 * モックリクエスト
 */
export function createMockRequest(overrides = {}) {
  return {
    query: {},
    body: {},
    params: {},
    get: jest.fn(),
    header: jest.fn(),
    accepts: jest.fn(),
    acceptsCharsets: jest.fn(),
    acceptsEncodings: jest.fn(),
    acceptsLanguages: jest.fn(),
    range: jest.fn(),
    ...overrides
  } as any; // Express.Requestとして扱えるように型アサーション
}

/**
 * モックレスポンス
 */
export function createMockResponse() {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  return res;
}

/**
 * 日付をモック
 * @param isoDate ISO形式の日付文字列
 */
export function mockDate(isoDate: string) {
  const originalDate = global.Date;
  const mockDate = class extends originalDate {
    constructor(...args: any[]) {
      if (args.length === 0) {
        super(isoDate);
      } else {
        super(...(args as [any]));
      }
    }
  };
  global.Date = mockDate as DateConstructor;
  
  return () => {
    global.Date = originalDate;
  };
}