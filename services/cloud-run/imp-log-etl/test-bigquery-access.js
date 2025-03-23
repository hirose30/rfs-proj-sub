// BigQueryアクセス権限テストスクリプト
const {BigQuery} = require('@google-cloud/bigquery');

async function testBigQueryAccess() {
  try {
    console.log('BigQueryアクセス権限テストを開始します...');
    
    // BigQueryクライアントの初期化
    const bigquery = new BigQuery({
      projectId: 'rfs-proj',
    });
    
    console.log('1. プロジェクト内のデータセット一覧を取得します...');
    const [datasets] = await bigquery.getDatasets();
    console.log('データセット一覧:');
    datasets.forEach(dataset => {
      console.log(`- ${dataset.id}`);
    });
    
    // sg_reports_tmpデータセットの存在確認
    console.log('\n2. sg_reports_tmpデータセットの存在を確認します...');
    const datasetId = 'sg_reports_tmp';
    try {
      const [datasetExists] = await bigquery.dataset(datasetId).exists();
      if (datasetExists) {
        console.log(`${datasetId}データセットは存在します`);
        
        // データセット内のテーブル一覧を取得
        console.log('\n3. データセット内のテーブル一覧を取得します...');
        const [tables] = await bigquery.dataset(datasetId).getTables();
        console.log('テーブル一覧:');
        tables.forEach(table => {
          console.log(`- ${table.id}`);
        });
        
        // テストテーブルの作成を試みる
        console.log('\n4. テストテーブルの作成を試みます...');
        const testTableId = 'test_table_' + Date.now();
        const schema = [
          {name: 'timestamp_col', type: 'TIMESTAMP'},
          {name: 'name', type: 'STRING'},
        ];
        
        const options = {
          schema: schema,
          timePartitioning: {
            type: 'DAY',
            field: 'timestamp_col',
          },
        };
        
        try {
          const [table] = await bigquery
            .dataset(datasetId)
            .createTable(testTableId, options);
          
          console.log(`テーブル ${table.id} が作成されました`);
          
          // テストテーブルの削除
          console.log('\n5. テストテーブルを削除します...');
          await bigquery.dataset(datasetId).table(testTableId).delete();
          console.log(`テーブル ${testTableId} が削除されました`);
        } catch (error) {
          console.error('テーブルの作成または削除に失敗しました:', error);
        }
      } else {
        console.log(`${datasetId}データセットは存在しません`);
      }
    } catch (error) {
      console.error('データセットの確認に失敗しました:', error);
    }
  } catch (error) {
    console.error('BigQueryアクセステストに失敗しました:', error);
  }
}

// テストの実行
testBigQueryAccess();