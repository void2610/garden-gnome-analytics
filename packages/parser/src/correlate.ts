// run ログと通常ログを時刻ベースで突合する
import { basename } from 'node:path';
import type { CorrelatedRun, NormalLogEntry, RawRunFile } from '@gga/shared';

// "[AnalyticsLogger] ランログ開始: <path>/run_xxx.log" から run ファイル名を抽出
const RUN_LOG_OPEN_RE = /ランログ開始[:：]\s*(.+\.log)\s*$/;

export function extractRunLogPath(message: string): string | null {
  const m = message.match(RUN_LOG_OPEN_RE);
  if (!m) return null;
  return m[1] ?? null;
}

export function correlate(runs: RawRunFile[], normals: NormalLogEntry[]): CorrelatedRun[] {
  // 各 run の時刻範囲を計算
  return runs.map((run) => {
    const startedAt = run.events.length > 0 ? (run.events[0]?.date ?? undefined) : undefined;
    const endedAt =
      run.events.length > 0 ? (run.events[run.events.length - 1]?.date ?? undefined) : undefined;

    const relatedErrors = normals.filter((entry) => {
      if (entry.level !== 'Error' && entry.level !== 'Exception') return false;
      if (!startedAt || !endedAt) return false;
      const t = entry.date.getTime();
      // 範囲を 5 秒だけ前後に拡張（ログ書き込みのラグ吸収）
      return t >= startedAt.getTime() - 5000 && t <= endedAt.getTime() + 5000;
    });

    return {
      runId: run.runId,
      filePath: run.filePath,
      events: run.events,
      startedAt,
      endedAt,
      relatedErrors,
    };
  });
}

// run ファイルのパスから runId を生成（拡張子なしのファイル名 = runId）
export function runIdFromPath(path: string): string {
  const name = basename(path);
  return name.replace(/\.log$/i, '');
}
