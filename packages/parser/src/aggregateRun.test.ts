import { describe, expect, it } from 'vitest';
import { aggregateRun } from './aggregateRun';
import type { RunEvent } from '@gga/shared';

function ev(ts: string, body: RunEvent['body']): RunEvent {
  return { timestamp: ts, date: new Date(ts), body, raw: '' };
}

describe('aggregateRun', () => {
  it('SessionEnd ありで HP > 0 なら win', () => {
    const r = aggregateRun({
      runId: 'r1',
      eventSlug: 'e',
      deviceSlug: 'd',
      events: [
        ev('2026-05-03T10:00:00.000', { event: 'SessionStart' }),
        ev('2026-05-03T10:01:00.000', { event: 'BattleWin', remainHp: 80, maxHp: 100 }),
        ev('2026-05-03T10:02:00.000', { event: 'SessionEnd' }),
      ],
    });
    expect(r.outcome).toBe('win');
    expect(r.finalHp).toBe(80);
    expect(r.maxHp).toBe(100);
    expect(r.battleWinCount).toBe(1);
  });

  it('HP=0 なら loss', () => {
    const r = aggregateRun({
      runId: 'r1',
      eventSlug: 'e',
      deviceSlug: 'd',
      events: [
        ev('2026-05-03T10:00:00.000', { event: 'SessionStart' }),
        ev('2026-05-03T10:01:00.000', { event: 'PlayerHealthChanged', hp: 0 }),
      ],
    });
    expect(r.outcome).toBe('loss');
  });

  it('SessionEnd なしで HP > 0 なら abandoned', () => {
    const r = aggregateRun({
      runId: 'r1',
      eventSlug: 'e',
      deviceSlug: 'd',
      events: [ev('2026-05-03T10:00:00.000', { event: 'SessionStart' })],
    });
    expect(r.outcome).toBe('abandoned');
  });

  it('BattleStart の deckCards から最終デッキサイズを取得', () => {
    const r = aggregateRun({
      runId: 'r1',
      eventSlug: 'e',
      deviceSlug: 'd',
      events: [
        ev('2026-05-03T10:00:00.000', { event: 'SessionStart' }),
        ev('2026-05-03T10:01:00.000', {
          event: 'BattleStart',
          deckCards: 'Olive(Seed);Fraxinus(Seed);Carota(Seed)',
        }),
        ev('2026-05-03T10:02:00.000', { event: 'SessionEnd' }),
      ],
    });
    expect(r.finalDeckSize).toBe(3);
  });
});
