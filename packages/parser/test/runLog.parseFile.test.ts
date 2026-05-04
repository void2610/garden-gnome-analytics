import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseRunLogFileToArray } from '../src/runLog/parseFile';

const here = dirname(fileURLToPath(import.meta.url));
const fixtureDir = join(here, 'fixtures');

describe('parseRunLogFile', () => {
  it('短いランをすべてパースできる', async () => {
    const events = await parseRunLogFileToArray(join(fixtureDir, 'run-short.log'));
    expect(events.length).toBe(10);
    expect(events[0]?.body.event).toBe('SessionStart');
    expect(events[events.length - 1]?.body.event).toBe('SessionEnd');
  });

  it('壊れた行はスキップしてエラーを通知する', async () => {
    const errors: string[] = [];
    const events = await parseRunLogFileToArray(
      join(fixtureDir, 'run-malformed.log'),
      { onError: (e) => errors.push(e.kind) },
    );
    // Session(Start/End) と TurnStart の 3 件は通る
    expect(events.length).toBe(3);
    expect(errors).toContain('tokenize');
    expect(errors).toContain('unknown_event');
  });

  it('リワード関連を含むランをパースできる', async () => {
    const events = await parseRunLogFileToArray(
      join(fixtureDir, 'run-with-rewards.log'),
    );
    const types = events.map((e) => e.body.event);
    expect(types).toContain('RewardSelected');
    expect(types).toContain('TreasureCollected');
    expect(types).toContain('CultivationResult');
  });
});
