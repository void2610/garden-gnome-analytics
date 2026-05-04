// DuckDB-Wasm のシングルトン初期化
import * as duckdb from '@duckdb/duckdb-wasm';

let dbPromise: Promise<duckdb.AsyncDuckDB> | null = null;

export function getDb(): Promise<duckdb.AsyncDuckDB> {
  if (!dbPromise) dbPromise = createDb();
  return dbPromise;
}

async function createDb(): Promise<duckdb.AsyncDuckDB> {
  const allBundles = duckdb.getJsDelivrBundles();
  const bundle = await duckdb.selectBundle(allBundles);
  // worker URL は CORS 対応のため Blob 経由で渡す
  const workerUrl = URL.createObjectURL(
    new Blob([`importScripts("${bundle.mainWorker!}");`], {
      type: 'text/javascript',
    }),
  );
  const worker = new Worker(workerUrl);
  const logger = new duckdb.ConsoleLogger();
  const db = new duckdb.AsyncDuckDB(logger, worker);
  await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
  URL.revokeObjectURL(workerUrl);
  return db;
}
