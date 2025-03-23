/**
 * 環境設定
 * 各環境（開発、ステージング、本番）に対する設定を定義
 */

export interface EnvironmentConfig {
  /** BigQueryデータセット名 */
  dataset: string;
  /** テーブル名 */
  tableName: string;
  /** プロジェクトID */
  projectId: string;
}

/**
 * 環境設定マップ
 */
const environments: Record<string, EnvironmentConfig> = {
  development: {
    dataset: 'sg_reports_tmp',
    tableName: 'signage_impressions',
    projectId: 'rfs-proj',
  },
  staging: {
    dataset: 'sg_reports_staging',
    tableName: 'signage_impressions',
    projectId: 'rfs-proj',
  },
  production: {
    dataset: 'sg_reports_production',
    tableName: 'signage_impressions',
    projectId: 'rfs-proj',
  },
};

/**
 * 現在の環境設定を取得
 * @returns 現在の環境に対応する設定
 */
export function getCurrentEnvironment(): EnvironmentConfig {
  const env = process.env.NODE_ENV || 'development';
  const config = environments[env];
  
  if (!config) {
    throw new Error(`Unknown environment: ${env}`);
  }
  
  return config;
}

/**
 * 完全なテーブル名を取得（プロジェクト.データセット.テーブル形式）
 * @returns 完全なテーブル名
 */
export function getFullyQualifiedTableName(): string {
  const config = getCurrentEnvironment();
  return `${config.projectId}.${config.dataset}.${config.tableName}`;
}

/**
 * 環境変数から設定値を取得（存在しない場合はデフォルト値を使用）
 * @param key 環境変数名
 * @param defaultValue デフォルト値
 * @returns 設定値
 */
export function getEnvVar(key: string, defaultValue: string): string {
  return process.env[key] || defaultValue;
}