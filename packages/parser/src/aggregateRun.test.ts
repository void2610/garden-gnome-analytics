import type { RunEvent } from '@gga/shared';
import { describe, expect, it } from 'vitest';
import { aggregateRun } from './aggregateRun';

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

  it('被ダメージで残りの HP が 0 になったら loss', () => {
    const r = aggregateRun({
      runId: 'r1',
      eventSlug: 'e',
      deviceSlug: 'd',
      events: [
        ev('2026-05-03T10:00:00.000', { event: 'SessionStart' }),
        ev('2026-05-03T10:01:00.000', {
          event: 'PlayerDamaged',
          actualDamage: 5,
          remainHp: 0,
          source: 'Enemy:Slime#0',
        }),
      ],
    });
    expect(r.outcome).toBe('loss');
    expect(r.finalHp).toBe(0);
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

  it.each([
    ['Win', 'win'],
    ['Lose', 'loss'],
    ['TutorialClear', 'tutorial'],
    ['ReturnToTitle', 'abandoned'],
    ['IdleReturn', 'abandoned'],
    ['TimeLimit', 'abandoned'],
    ['Quit', 'abandoned'],
  ])('SessionEnd の result が %s なら %s', (result, outcome) => {
    const r = aggregateRun({
      runId: 'r1',
      eventSlug: 'e',
      deviceSlug: 'd',
      events: [
        ev('2026-10-31T11:16:54.000', { event: 'SessionStart' }),
        ev('2026-10-31T11:18:12.000', { event: 'BattleWin', remainHp: 100, maxHp: 100 }),
        ev('2026-10-31T11:22:36.000', { event: 'SessionEnd', result }),
      ],
    });
    expect(r.outcome).toBe(outcome);
  });

  it('同じステージが続けて入場として書かれても 1 回と数える', () => {
    const r = aggregateRun({
      runId: 'r1',
      eventSlug: 'e',
      deviceSlug: 'd',
      events: [
        ev('2026-10-31T11:16:57.544', {
          event: 'StageEnter',
          stageType: 'Battle',
          stageId: 'Layer0_0_Battle',
        }),
        ev('2026-10-31T11:16:58.111', {
          event: 'StageEnter',
          stageType: 'Battle',
          stageId: 'Layer0_0_Battle',
        }),
        ev('2026-10-31T11:18:33.543', {
          event: 'StageEnter',
          stageType: 'Battle',
          stageId: 'Layer1_0_Battle',
        }),
      ],
    });
    expect(r.stageCount).toBe(2);
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
