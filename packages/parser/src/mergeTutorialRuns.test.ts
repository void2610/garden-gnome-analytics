import type { RunEvent } from '@gga/shared';
import { describe, expect, it } from 'vitest';
import { mergeTutorialRuns, type RunFile } from './mergeTutorialRuns';

function ev(ts: string, body: RunEvent['body']): RunEvent {
  return { timestamp: ts, date: new Date(ts), body, raw: '' };
}

function tutorial(runId: string, start: string, end: string, result: string): RunFile {
  return {
    runId,
    path: `${runId}.log`,
    events: [
      ev(start, { event: 'SessionStart' }),
      ev(start, { event: 'BattleStart', stageId: 'Tutorial', nodeType: 'Tutorial' }),
      ev(end, { event: 'SessionEnd', result }),
    ],
  };
}

function main(runId: string, start: string): RunFile {
  return {
    runId,
    path: `${runId}.log`,
    events: [
      ev(start, { event: 'SessionStart' }),
      ev(start, { event: 'BattleStart', stageId: 'Layer0_0_Battle', nodeType: 'Battle' }),
    ],
  };
}

describe('mergeTutorialRuns', () => {
  it('チュートリアルを終えた直後に始まった本編と 1 ランにまとめ、本編の runId を使う', () => {
    const t = tutorial('t', '2026-10-31T11:44:13.752', '2026-10-31T11:48:16.549', 'TutorialClear');
    const m = main('m', '2026-10-31T11:48:16.671');
    const r = mergeTutorialRuns([m, t]);
    expect(r).toHaveLength(1);
    expect(r[0]?.runId).toBe('m');
    expect(r[0]?.events).toEqual([...t.events, ...m.events]);
  });

  it('途中でやめたチュートリアルは、直後に本編が始まってもまとめない', () => {
    const t = tutorial('t', '2026-10-31T13:31:37.905', '2026-10-31T13:35:39.305', 'ReturnToTitle');
    const m = main('m', '2026-10-31T13:35:40.000');
    expect(mergeTutorialRuns([t, m]).map((r) => r.runId)).toEqual(['t', 'm']);
  });

  it('チュートリアルの後にまたチュートリアルが始まったらまとめない', () => {
    const t1 = tutorial(
      't1',
      '2026-10-31T13:00:00.000',
      '2026-10-31T13:03:00.000',
      'TutorialClear',
    );
    const t2 = tutorial(
      't2',
      '2026-10-31T13:03:00.200',
      '2026-10-31T13:06:00.000',
      'TutorialClear',
    );
    expect(mergeTutorialRuns([t1, t2]).map((r) => r.runId)).toEqual(['t1', 't2']);
  });

  it('チュートリアルの後、間を空けて始まった本編はまとめない', () => {
    const t = tutorial('t', '2026-10-31T13:00:00.000', '2026-10-31T13:03:00.000', 'TutorialClear');
    const m = main('m', '2026-10-31T13:10:00.000');
    expect(mergeTutorialRuns([t, m]).map((r) => r.runId)).toEqual(['t', 'm']);
  });
});
