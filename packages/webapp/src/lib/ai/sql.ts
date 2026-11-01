// AI チャットが分析に使う SQL の実行。全データセットを束ねたビューを用意し、読むだけの文を実行する
import { query } from '../duckdb/query';
import {
  errorsAllParquetUrls,
  eventsAllParquetUrls,
  readParquetSql,
  runsAllParquetUrls,
} from '../duckdb/paths';

export interface DatasetRef {
  eventSlug: string;
  deviceSlug: string;
}

// ツールの結果はそのままモデルの入力になるので、行数と 1 セルの長さを抑える
const MAX_ROWS = 200;
const MAX_CELL_LENGTH = 500;

const READ_ONLY_HEAD =
  /^(select|with|describe|summarize|show|explain|from|values|pivot|unpivot)\b/i;

// 読むだけの 1 文でなければ、モデルへ返す理由を返す
export function checkReadOnlySql(sql: string): string | null {
  const body = stripTrailingSemicolons(stripComments(sql)).trim();
  if (body === '') return 'SQL が空です';
  // 文字列の中の ; まで見分けないが、分析の SQL で文字列に ; を書くことはまず無い
  if (body.includes(';')) return '1 回に実行できるのは 1 文だけです';
  if (!READ_ONLY_HEAD.test(body)) {
    return 'SELECT / WITH / DESCRIBE / SUMMARIZE などの読むだけの文しか実行できません';
  }
  return null;
}

function stripComments(sql: string): string {
  return sql.replace(/--[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
}

function stripTrailingSemicolons(sql: string): string {
  return sql.replace(/[\s;]+$/, '');
}

let viewsKey: string | null = null;
let viewsPromise: Promise<void> | null = null;

// events / runs / errors ビューを、渡したデータセットの Parquet を束ねて作る
export function ensureAnalysisViews(datasets: DatasetRef[]): Promise<void> {
  const key = datasets.map((d) => `${d.eventSlug}/${d.deviceSlug}`).join(',');
  if (viewsPromise && viewsKey === key) return viewsPromise;
  viewsKey = key;
  viewsPromise = (async () => {
    await query(
      `CREATE OR REPLACE VIEW events AS SELECT * FROM ${readParquetSql(eventsAllParquetUrls(datasets))}`,
    );
    await query(
      `CREATE OR REPLACE VIEW runs AS SELECT * FROM ${readParquetSql(runsAllParquetUrls(datasets))}`,
    );
    await query(
      `CREATE OR REPLACE VIEW errors AS SELECT * FROM ${readParquetSql(errorsAllParquetUrls(datasets))}`,
    );
  })().catch((e) => {
    viewsPromise = null;
    throw e;
  });
  return viewsPromise;
}

// 読むだけの SQL を実行し、モデルが読みやすい JSON の文字列にして返す
export async function runReadOnlySql(sql: string, datasets: DatasetRef[]): Promise<string> {
  const reason = checkReadOnlySql(sql);
  if (reason) throw new Error(reason);
  await ensureAnalysisViews(datasets);
  const rows = await query(stripTrailingSemicolons(stripComments(sql)));
  const shown = rows.slice(0, MAX_ROWS).map(truncateRow);
  return JSON.stringify({
    rowCount: rows.length,
    truncated: rows.length > MAX_ROWS,
    rows: shown,
  });
}

function truncateRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    out[k] =
      typeof v === 'string' && v.length > MAX_CELL_LENGTH ? `${v.slice(0, MAX_CELL_LENGTH)}…` : v;
  }
  return out;
}
