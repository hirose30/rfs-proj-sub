/**
 * 日付操作ユーティリティ
 */
export class DateUtil {
  /**
   * JST基準の前日の日付を取得
   * @returns 前日の日付（JST）
   */
  static getYesterdayJST(): Date {
    // JSTタイムゾーンを明示的に設定
    const now = new Date();
    // 日本時間に調整（UTC+9）
    const jstNow = new Date(now.getTime() + (9 * 60 * 60 * 1000));
    
    // 日付を1日前に設定
    const yesterday = new Date(jstNow);
    yesterday.setDate(yesterday.getDate() - 1);
    
    // 時刻部分をリセット（00:00:00.000）
    yesterday.setHours(0, 0, 0, 0);
    
    return yesterday;
  }

  /**
   * 指定された開始日から終了日までの日付範囲を生成
   * @param startDate 開始日
   * @param endDate 終了日
   * @returns 日付の配列
   */
  static generateDateRange(startDate: Date, endDate: Date): Date[] {
    const dates: Date[] = [];
    const currentDate = new Date(startDate);
    
    // 開始日から終了日まで1日ずつ増やしながら配列に追加
    while (currentDate <= endDate) {
      dates.push(new Date(currentDate));
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return dates;
  }

  /**
   * 日付を指定されたフォーマットに変換
   * @param date 日付オブジェクト
   * @param format フォーマット文字列（例: 'YYYY-MM-DD'）
   * @returns フォーマットされた日付文字列
   */
  static formatDate(date: Date, format: string): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

    return format
      .replace('YYYY', String(year))
      .replace('MM', month)
      .replace('DD', day)
      .replace('HH', hours)
      .replace('mm', minutes)
      .replace('ss', seconds);
  }

  /**
   * 日付文字列の妥当性を検証
   * @param dateStr 検証する日付文字列（YYYY-MM-DD形式）
   * @returns 妥当な日付の場合はtrue、そうでない場合はfalse
   */
  static isValidDate(dateStr: string): boolean {
    if (!dateStr) return false;
    
    // YYYY-MM-DD形式かどうかを正規表現でチェック
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(dateStr)) return false;
    
    // 日付オブジェクトに変換して妥当性をチェック
    const date = new Date(dateStr);
    const timestamp = date.getTime();
    
    if (isNaN(timestamp)) return false;
    
    // 元の値と変換後の値が一致するかチェック
    return dateStr === this.formatDate(date, 'YYYY-MM-DD');
  }
}