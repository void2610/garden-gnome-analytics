// data/ 配下を走査して public-data/*.parquet を生成するメイン処理
import { rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import pino from 'pino';
import { aggregateRun } from './aggregateRun';
import { runIdFromPath } from './correlate';
import { parseNormalLogFile } from './normalLog/parseFile';
import { parseRunLogFileToArray } from './runLog/parseFile';
import { scanDataDir } from './scan';
import {
  type ErrorRow,
  type EventRow,
  type RunRow,
  writeParquetSet,
} from './writer';
import { writeManifest, type ManifestDataset } from './manifest';

export interface IngestOptions {
  dataDir: string;
  outDir: string;
  dev?: boolean;
  clean?: boolean;
  filter?: string; // event-slug でフィルタ
  logger?: pino.Logger;
}

export interface IngestResult {
  datasets: number;
  events: number;
  runs: number;
  errors: number;
  warnings: string[];
}

export async function runIngest(options: IngestOptions): Promise<IngestResult> {
  const log = options.logger ?? pino({ level: 'info' });
  const dataDir = resolve(options.dataDir);
  const outDir = resolve(options.outDir);

  if (options.clean) {
    log.info(`出力先を削除: ${outDir}`);
    await rm(outDir, { recursive: true, force: true });
  }

  log.info(`scan: ${dataDir}`);
  const scan = await scanDataDir(dataDir);
  for (const w of scan.warnings) log.warn(w, 'scan warning');

  let datasets = scan.datasets;
  if (options.filter) {
    datasets = datasets.filter((d) => d.eventSlug === options.filter);
  }
  log.info(`データセット数: ${datasets.length}`);

  const allEvents: EventRow[] = [];
  const allRuns: RunRow[] = [];
  const allErrors: ErrorRow[] = [];
  const manifestEntries: ManifestDataset[] = [];
  const warnings: string[] = scan.warnings.map((w) => `${w.path}: ${w.message}`);

  for (const ds of datasets) {
    log.info(
      `parsing dataset event=${ds.eventSlug} device=${ds.deviceSlug} runs=${ds.runLogPaths.length} normals=${ds.normalLogPaths.length}`,
    );

    // 通常ログ全 entry を集約 (エラー突合に使う)
    const normals: import('@gga/shared').NormalLogEntry[] = [];
    for (const np of ds.normalLogPaths) {
      try {
        const entries = await parseNormalLogFile(np);
        normals.push(...entries);
      } catch (e) {
        warnings.push(`normal log read failed ${np}: ${(e as Error).message}`);
      }
    }

    let dsEventCount = 0;
    let dsRunCount = 0;
    let dsErrorCount = 0;
    let periodFrom: Date | undefined;
    let periodTo: Date | undefined;
    // BattleStart に mapName が含まれる行を 1 件でも観測したか
    let hasMapName = false;

    for (let i = 0; i < ds.runLogPaths.length; i++) {
      const rp = ds.runLogPaths[i];
      if (!rp) continue;
      log.info(`  parsing run ${i + 1}/${ds.runLogPaths.length}: ${rp}`);
      const events = await parseRunLogFileToArray(rp, {
        onError: (e) => {
          warnings.push(
            `${rp}#${e.lineNumber} (${e.kind}): ${e.message.slice(0, 120)}`,
          );
        },
      });
      const runId = runIdFromPath(rp);

      // events 行を生成
      for (let seq = 0; seq < events.length; seq++) {
        const ev = events[seq];
        if (!ev) continue;
        const { event, ...payload } = ev.body;
        allEvents.push({
          event_slug: ds.eventSlug,
          device_slug: ds.deviceSlug,
          run_id: runId,
          seq,
          timestamp: ev.timestamp,
          event_type: event,
          payload: JSON.stringify(payload),
          game_version: ds.meta.game_version ?? null,
        });
        dsEventCount += 1;

        if (
          !hasMapName &&
          event === 'BattleStart' &&
          typeof (payload as Record<string, unknown>).mapName === 'string' &&
          (payload as Record<string, unknown>).mapName !== ''
        ) {
          hasMapName = true;
        }

        if (!periodFrom || ev.date < periodFrom) periodFrom = ev.date;
        if (!periodTo || ev.date > periodTo) periodTo = ev.date;
      }

      // run summary
      const summary = aggregateRun({
        runId,
        eventSlug: ds.eventSlug,
        deviceSlug: ds.deviceSlug,
        events,
        gameVersion: ds.meta.game_version,
      });
      allRuns.push({
        run_id: summary.runId,
        event_slug: summary.eventSlug,
        device_slug: summary.deviceSlug,
        started_at: summary.startedAt?.toISOString() ?? null,
        ended_at: summary.endedAt?.toISOString() ?? null,
        duration_sec: summary.durationSec ?? null,
        stage_count: summary.stageCount,
        battle_win_count: summary.battleWinCount,
        battle_loss_count: summary.battleLossCount,
        final_hp: summary.finalHp ?? null,
        max_hp: summary.maxHp ?? null,
        final_deck_size: summary.finalDeckSize ?? null,
        outcome: summary.outcome,
        game_version: summary.gameVersion ?? null,
      });
      dsRunCount += 1;

      // この run の時刻範囲に紐付くエラー
      const start = summary.startedAt?.getTime() ?? 0;
      const end = summary.endedAt?.getTime() ?? Number.POSITIVE_INFINITY;
      for (const e of normals) {
        if (e.level !== 'Error' && e.level !== 'Exception') continue;
        const t = e.date.getTime();
        if (t < start - 5000 || t > end + 5000) continue;
        allErrors.push({
          event_slug: ds.eventSlug,
          device_slug: ds.deviceSlug,
          run_id: runId,
          timestamp: e.timestamp,
          level: e.level,
          message: e.message,
          stack_trace: e.stackTrace ?? null,
        });
        dsErrorCount += 1;
      }
    }

    // run に紐付かない errors も収録（run 範囲外）
    for (const e of normals) {
      if (e.level !== 'Error' && e.level !== 'Exception') continue;
      // すでに run に紐付いた entry は重複しないように timestamp/level/message でユニーク扱い
      const dup = allErrors.find(
        (a) =>
          a.event_slug === ds.eventSlug &&
          a.device_slug === ds.deviceSlug &&
          a.timestamp === e.timestamp &&
          a.level === e.level &&
          a.message === e.message,
      );
      if (dup) continue;
      allErrors.push({
        event_slug: ds.eventSlug,
        device_slug: ds.deviceSlug,
        run_id: null,
        timestamp: e.timestamp,
        level: e.level,
        message: e.message,
        stack_trace: e.stackTrace ?? null,
      });
      dsErrorCount += 1;
    }

    manifestEntries.push({
      eventSlug: ds.eventSlug,
      deviceSlug: ds.deviceSlug,
      meta: ds.meta,
      eventMeta: ds.eventMeta,
      runCount: dsRunCount,
      eventCount: dsEventCount,
      errorCount: dsErrorCount,
      period: {
        from: periodFrom ? periodFrom.toISOString() : null,
        to: periodTo ? periodTo.toISOString() : null,
      },
      hasMapName,
    });
  }

  log.info(
    `writing parquet: events=${allEvents.length} runs=${allRuns.length} errors=${allErrors.length}`,
  );
  await writeParquetSet({
    outDir,
    events: allEvents,
    runs: allRuns,
    errors: allErrors,
    alsoWriteJsonl: options.dev,
  });

  await writeManifest(outDir, {
    generatedAt: new Date().toISOString(),
    datasets: manifestEntries,
  });

  log.info('done');

  return {
    datasets: datasets.length,
    events: allEvents.length,
    runs: allRuns.length,
    errors: allErrors.length,
    warnings,
  };
}
