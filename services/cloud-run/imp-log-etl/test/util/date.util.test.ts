import { DateUtil } from '../../src/util/date.util';
import { mockDate } from '../helpers/mocks';

describe('DateUtil', () => {
  describe('getYesterdayJST', () => {
    it('should return yesterday date in JST', () => {
      // 2025-03-23 12:00:00 UTC をモック
      const resetMock = mockDate('2025-03-23T12:00:00Z');
      
      try {
        const yesterday = DateUtil.getYesterdayJST();
        
        // 日本時間では2025-03-23 21:00:00なので、前日は2025-03-22
        expect(yesterday.getFullYear()).toBe(2025);
        expect(yesterday.getMonth()).toBe(2); // 0-indexed (3月 = 2)
        expect(yesterday.getDate()).toBe(22);
        
        // 時刻部分は00:00:00にリセットされているはず
        expect(yesterday.getHours()).toBe(0);
        expect(yesterday.getMinutes()).toBe(0);
        expect(yesterday.getSeconds()).toBe(0);
        expect(yesterday.getMilliseconds()).toBe(0);
      } finally {
        resetMock();
      }
    });
  });

  describe('formatDate', () => {
    it('should format date according to the specified format', () => {
      const date = new Date(2025, 2, 22, 15, 30, 45); // 2025-03-22 15:30:45
      
      expect(DateUtil.formatDate(date, 'YYYY-MM-DD')).toBe('2025-03-22');
      expect(DateUtil.formatDate(date, 'YYYY/MM/DD')).toBe('2025/03/22');
      expect(DateUtil.formatDate(date, 'YYYY-MM-DD HH:mm:ss')).toBe('2025-03-22 15:30:45');
      expect(DateUtil.formatDate(date, 'MM/DD/YYYY')).toBe('03/22/2025');
      expect(DateUtil.formatDate(date, 'DD.MM.YYYY')).toBe('22.03.2025');
    });
  });

  describe('isValidDate', () => {
    it('should return true for valid date strings', () => {
      expect(DateUtil.isValidDate('2025-03-22')).toBe(true);
      expect(DateUtil.isValidDate('2025-01-01')).toBe(true);
      expect(DateUtil.isValidDate('2025-12-31')).toBe(true);
      expect(DateUtil.isValidDate('2024-02-29')).toBe(true); // うるう年
    });

    it('should return false for invalid date strings', () => {
      expect(DateUtil.isValidDate('')).toBe(false);
      expect(DateUtil.isValidDate('invalid')).toBe(false);
      expect(DateUtil.isValidDate('2025/03/22')).toBe(false); // フォーマットが異なる
      expect(DateUtil.isValidDate('2025-3-22')).toBe(false); // 月が1桁
      expect(DateUtil.isValidDate('2025-03-32')).toBe(false); // 存在しない日付
      expect(DateUtil.isValidDate('2025-13-01')).toBe(false); // 存在しない月
      expect(DateUtil.isValidDate('2025-02-30')).toBe(false); // 存在しない日付
    });
  });
});