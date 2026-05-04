// 1 ラン分の RunEvent[] からサマリ行を作る純関数
import type { RunEvent } from '@gga/shared';

export type RunOutcome = 'win' | 'loss' | 'abandoned';

export interface RunSummary {
  runId: string;
  eventSlug: string;
  deviceSlug: string;
  startedAt: Date | undefined;
  endedAt: Date | undefined;
  durationSec: number | undefined;
  stageCount: number;
  battleWinCount: number;
  battleLossCount: number;
  finalHp: number | undefined;
  maxHp: number | undefined;
  finalDeckSize: number | undefined;
  outcome: RunOutcome;
  gameVersion: string | undefined;
}

export interface AggregateInput {
  runId: string;
  eventSlug: string;
  deviceSlug: string;
  events: RunEvent[];
  gameVersion?: string;
}

export function aggregateRun(input: AggregateInput): RunSummary {
  const { events } = input;
  const startedAt = events[0]?.date;
  const endedAt = events[events.length - 1]?.date;
  const durationSec =
    startedAt && endedAt ? (endedAt.getTime() - startedAt.getTime()) / 1000 : undefined;

  let stageCount = 0;
  let battleWinCount = 0;
  let battleLossCount = 0;
  let finalHp: number | undefined;
  let maxHp: number | undefined;
  let finalDeckSize: number | undefined;
  let hasSessionEnd = false;
  let lastHpZero = false;

  for (const ev of events) {
    const b = ev.body;
    switch (b.event) {
      case 'StageEnter':
        stageCount += 1;
        break;
      case 'BattleStart':
        if (b.deckCards) {
          finalDeckSize = b.deckCards.split(';').filter((s) => s.length > 0).length;
        }
        break;
      case 'BattleWin':
        battleWinCount += 1;
        if (typeof b.remainHp === 'number') finalHp = b.remainHp;
        if (typeof b.maxHp === 'number') maxHp = b.maxHp;
        break;
      case 'BattleLose':
        battleLossCount += 1;
        if (typeof b.remainHp === 'number') finalHp = b.remainHp;
        if (typeof b.maxHp === 'number') maxHp = b.maxHp;
        lastHpZero = true;
        break;
      case 'TurnStart':
        if (typeof b.hp === 'number') finalHp = b.hp;
        if (typeof b.maxHp === 'number') maxHp = b.maxHp;
        break;
      case 'PlayerHealthChanged':
        if (typeof b.hp === 'number') {
          finalHp = b.hp;
          if (b.hp <= 0) lastHpZero = true;
        }
        break;
      case 'PlayerDamaged':
        if (typeof b.hp === 'number') {
          finalHp = b.hp;
          if (b.hp <= 0) lastHpZero = true;
        }
        break;
      case 'SessionEnd':
        hasSessionEnd = true;
        break;
    }
  }

  let outcome: RunOutcome;
  if (lastHpZero) {
    outcome = 'loss';
  } else if (hasSessionEnd) {
    outcome = 'win';
  } else {
    outcome = 'abandoned';
  }

  return {
    runId: input.runId,
    eventSlug: input.eventSlug,
    deviceSlug: input.deviceSlug,
    startedAt,
    endedAt,
    durationSec,
    stageCount,
    battleWinCount,
    battleLossCount,
    finalHp,
    maxHp,
    finalDeckSize,
    outcome,
    gameVersion: input.gameVersion,
  };
}
