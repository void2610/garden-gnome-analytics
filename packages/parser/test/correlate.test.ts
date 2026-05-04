import { describe, expect, it } from 'vitest';
import { correlate, extractRunLogPath, runIdFromPath } from '../src/correlate';
import type { NormalLogEntry, RawRunFile } from '@gga/shared';

function makeEntry(ts: string, level: NormalLogEntry['level'], message: string): NormalLogEntry {
  return { timestamp: ts, date: new Date(ts), level, message };
}

describe('extractRunLogPath', () => {
  it('ランログ開始メッセージから path を取り出す', () => {
    const path = extractRunLogPath(
      '[AnalyticsLogger] ランログ開始: /Users/x/Logs/run_20260503_103049_645.log',
    );
    expect(path).toBe('/Users/x/Logs/run_20260503_103049_645.log');
  });
});

describe('runIdFromPath', () => {
  it('ファイル名から runId を作る', () => {
    expect(runIdFromPath('/foo/bar/run_20260503_103049_645.log')).toBe(
      'run_20260503_103049_645',
    );
  });
});

describe('correlate', () => {
  it('時刻範囲内のエラーを run に紐付ける', () => {
    const runs: RawRunFile[] = [
      {
        runId: 'run_a',
        filePath: '/x/run_a.log',
        events: [
          {
            timestamp: '2026-05-03T10:30:00.000',
            date: new Date('2026-05-03T10:30:00.000'),
            body: { event: 'SessionStart' },
            raw: '',
          },
          {
            timestamp: '2026-05-03T10:50:00.000',
            date: new Date('2026-05-03T10:50:00.000'),
            body: { event: 'SessionEnd' },
            raw: '',
          },
        ],
      },
    ];
    const normals: NormalLogEntry[] = [
      makeEntry('2026-05-03T10:00:00.000', 'Error', 'too early'),
      makeEntry('2026-05-03T10:40:00.000', 'Exception', 'in range'),
      makeEntry('2026-05-03T11:00:00.000', 'Error', 'too late'),
    ];
    const correlated = correlate(runs, normals);
    expect(correlated[0]?.relatedErrors).toHaveLength(1);
    expect(correlated[0]?.relatedErrors[0]?.message).toBe('in range');
  });
});
