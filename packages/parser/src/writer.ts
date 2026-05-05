// DuckDB を使って NDJSON → Parquet (zstd) を生成するライタ
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { DuckDBInstance } from '@duckdb/node-api';

// イベント 1 行分の NDJSON シリアライズ用 (型は緩く)
export interface EventRow {
  event_slug: string;
  device_slug: string;
  run_id: string;
  seq: number;
  timestamp: string; // ISO 8601 ローカル時刻
  event_type: string;
  payload: string; // JSON 文字列
  game_version: string | null;
}

export interface RunRow {
  run_id: string;
  event_slug: string;
  device_slug: string;
  started_at: string | null;
  ended_at: string | null;
  duration_sec: number | null;
  stage_count: number;
  battle_win_count: number;
  battle_loss_count: number;
  final_hp: number | null;
  max_hp: number | null;
  final_deck_size: number | null;
  outcome: 'win' | 'loss' | 'abandoned';
  game_version: string | null;
}

export interface ErrorRow {
  event_slug: string;
  device_slug: string;
  run_id: string | null;
  timestamp: string;
  level: string;
  message: string;
  stack_trace: string | null;
}

export interface WriteParquetOptions {
  outDir: string;
  // 各 partition (event=<slug>/device=<slug>) ごとに書き出す
  events: EventRow[];
  runs: RunRow[];
  errors: ErrorRow[];
  alsoWriteJsonl?: boolean;
}

// 1 行 NDJSON にする
function toNdjson(rows: object[]): string {
  return rows.map((r) => JSON.stringify(r)).join('\n');
}

async function writeNdjson(filePath: string, rows: object[]): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, toNdjson(rows), 'utf8');
}

interface PartitionGroup<T> {
  key: string;
  eventSlug: string;
  deviceSlug: string;
  rows: T[];
}

function groupByPartition<T extends { event_slug: string; device_slug: string }>(
  rows: T[],
): PartitionGroup<T>[] {
  const map = new Map<string, PartitionGroup<T>>();
  for (const r of rows) {
    const key = `${r.event_slug}/${r.device_slug}`;
    let g = map.get(key);
    if (!g) {
      g = { key, eventSlug: r.event_slug, deviceSlug: r.device_slug, rows: [] };
      map.set(key, g);
    }
    g.rows.push(r);
  }
  return [...map.values()];
}

async function copyNdjsonToParquet(args: {
  instance: DuckDBInstance;
  ndjsonPath: string;
  outPath: string;
  schemaSql: string;
}): Promise<void> {
  const conn = await args.instance.connect();
  try {
    // テーブル定義を CREATE TABLE で固定（read_json_auto は型が暴れることがある）
    await conn.run('DROP TABLE IF EXISTS staging');
    await conn.run(`CREATE TABLE staging (${args.schemaSql})`);
    // NDJSON → staging
    const escaped = args.ndjsonPath.replace(/'/g, "''");
    await conn.run(
      `INSERT INTO staging SELECT * FROM read_json('${escaped}', format='newline_delimited')`,
    );
    const outEscaped = args.outPath.replace(/'/g, "''");
    await conn.run(`COPY staging TO '${outEscaped}' (FORMAT PARQUET, COMPRESSION ZSTD)`);
    await conn.run('DROP TABLE staging');
  } finally {
    conn.disconnectSync();
  }
}

export async function writeParquetSet(opts: WriteParquetOptions): Promise<void> {
  const instance = await DuckDBInstance.create(':memory:');
  // 一時 NDJSON 置き場
  const tmpDir = join(opts.outDir, '.tmp');
  await mkdir(tmpDir, { recursive: true });

  try {
    // events
    for (const g of groupByPartition(opts.events)) {
      const ndjsonPath = join(tmpDir, `events_${g.eventSlug}_${g.deviceSlug}.ndjson`);
      await writeNdjson(ndjsonPath, g.rows);
      const outPath = join(
        opts.outDir,
        'events',
        `event=${g.eventSlug}`,
        `device=${g.deviceSlug}`,
        'data.parquet',
      );
      await mkdir(dirname(outPath), { recursive: true });
      await copyNdjsonToParquet({
        instance,
        ndjsonPath,
        outPath,
        schemaSql: `
          event_slug VARCHAR,
          device_slug VARCHAR,
          run_id VARCHAR,
          seq INTEGER,
          timestamp TIMESTAMP,
          event_type VARCHAR,
          payload VARCHAR,
          game_version VARCHAR
        `,
      });
      if (opts.alsoWriteJsonl) {
        const devOut = outPath.replace(/\.parquet$/, '.jsonl');
        await writeNdjson(devOut, g.rows);
      }
    }

    // runs
    for (const g of groupByPartition(opts.runs)) {
      const ndjsonPath = join(tmpDir, `runs_${g.eventSlug}_${g.deviceSlug}.ndjson`);
      await writeNdjson(ndjsonPath, g.rows);
      const outPath = join(
        opts.outDir,
        'runs',
        `event=${g.eventSlug}`,
        `device=${g.deviceSlug}`,
        'data.parquet',
      );
      await mkdir(dirname(outPath), { recursive: true });
      await copyNdjsonToParquet({
        instance,
        ndjsonPath,
        outPath,
        schemaSql: `
          run_id VARCHAR,
          event_slug VARCHAR,
          device_slug VARCHAR,
          started_at TIMESTAMP,
          ended_at TIMESTAMP,
          duration_sec DOUBLE,
          stage_count INTEGER,
          battle_win_count INTEGER,
          battle_loss_count INTEGER,
          final_hp INTEGER,
          max_hp INTEGER,
          final_deck_size INTEGER,
          outcome VARCHAR,
          game_version VARCHAR
        `,
      });
      if (opts.alsoWriteJsonl) {
        const devOut = outPath.replace(/\.parquet$/, '.jsonl');
        await writeNdjson(devOut, g.rows);
      }
    }

    // errors
    for (const g of groupByPartition(opts.errors)) {
      const ndjsonPath = join(tmpDir, `errors_${g.eventSlug}_${g.deviceSlug}.ndjson`);
      await writeNdjson(ndjsonPath, g.rows);
      const outPath = join(
        opts.outDir,
        'errors',
        `event=${g.eventSlug}`,
        `device=${g.deviceSlug}`,
        'data.parquet',
      );
      await mkdir(dirname(outPath), { recursive: true });
      await copyNdjsonToParquet({
        instance,
        ndjsonPath,
        outPath,
        schemaSql: `
          event_slug VARCHAR,
          device_slug VARCHAR,
          run_id VARCHAR,
          timestamp TIMESTAMP,
          level VARCHAR,
          message VARCHAR,
          stack_trace VARCHAR
        `,
      });
      if (opts.alsoWriteJsonl) {
        const devOut = outPath.replace(/\.parquet$/, '.jsonl');
        await writeNdjson(devOut, g.rows);
      }
    }
  } finally {
    // tmp ファイルを掃除
    await rm(tmpDir, { recursive: true, force: true });
  }
}
