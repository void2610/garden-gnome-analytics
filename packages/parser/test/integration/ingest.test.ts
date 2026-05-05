import { mkdir, mkdtemp, readdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DuckDBInstance } from '@duckdb/node-api';
import pino from 'pino';
import { runIngest } from '../../src/ingest';

const RUN_LOG = `2026-05-03T11:23:37.468|SessionStart
2026-05-03T11:23:43.343|StageEnter|stageType=Battle|stageId=Layer0_0
2026-05-03T11:23:43.347|BattleStart|stageId=Layer0_0_Battle|enemyCount=2|deckCards=Olive(Seed);Fraxinus(Seed)
2026-05-03T11:24:45.643|BattleWin|turnCount=2|remainHp=80|maxHp=100|killedEnemies=2|elapsedTime=62.3s
2026-05-03T11:25:10.000|SessionEnd
`;

const NORMAL_LOG = `2026-05-03 11:23:37.500 [Log] [AnalyticsLogger] ランログ開始: /tmp/run_20260503_112337_468.log
2026-05-03 11:24:00.000 [Exception] TestException: oh no
StackTrace line 1
StackTrace line 2

`;

const META = `event: テストイベント
event_date: 2026-05-03
device: TestDevice
game_version: 0.0.1
notes: 統合テスト
`;

describe('runIngest 統合テスト', () => {
  let tmpRoot: string;
  let dataDir: string;
  let outDir: string;

  beforeAll(async () => {
    tmpRoot = await mkdtemp(join(tmpdir(), 'gga-ingest-'));
    dataDir = join(tmpRoot, 'data');
    outDir = join(tmpRoot, 'public-data');
    const dsDir = join(dataDir, 'test-event', 'test-device');
    await mkdir(dsDir, { recursive: true });
    await writeFile(join(dsDir, 'meta.yaml'), META);
    await writeFile(join(dsDir, 'run_20260503_112337_468.log'), RUN_LOG);
    await writeFile(join(dsDir, 'the-garden-of-garden-gnome_20260503_112328.log'), NORMAL_LOG);
  });

  afterAll(async () => {
    // 一時ディレクトリは OS が掃除するので明示削除しない
  });

  it('ingest が完了し manifest と Parquet を生成する', async () => {
    const result = await runIngest({
      dataDir,
      outDir,
      logger: pino({ level: 'silent' }),
    });
    expect(result.datasets).toBe(1);
    expect(result.runs).toBe(1);
    expect(result.events).toBeGreaterThan(0);
    expect(result.errors).toBeGreaterThanOrEqual(1);

    // manifest.json
    const manifest = JSON.parse(await readFile(join(outDir, 'manifest.json'), 'utf8'));
    expect(manifest.datasets).toHaveLength(1);

    // events parquet ファイル列挙
    const eventsPartition = join(outDir, 'events');
    const eventDirs = await readdir(eventsPartition);
    expect(eventDirs.length).toBeGreaterThan(0);

    // duckdb で読み返して COUNT
    const inst = await DuckDBInstance.create(':memory:');
    const conn = await inst.connect();
    const res = await conn.runAndReadAll(
      `SELECT COUNT(*) AS c FROM read_parquet('${outDir}/events/event=*/device=*/data.parquet')`,
    );
    const rows = res.getRowObjects();
    expect(Number(rows[0]?.c)).toBe(result.events);
    conn.disconnectSync();
  });
});
