// 1 ラン分の RunEvent[] からサマリ行を作る純関数
import type { RunEvent } from '@gga/shared';

export type RunOutcome = 'win' | 'loss' | 'abandoned' | 'tutorial';

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
  let sessionResult: string | undefined;
  let lastHpZero = false;
  let lastStageId: string | undefined;

  for (const ev of events) {
    const b = ev.body;
    switch (b.event) {
      case 'StageEnter':
        // 同じノードを続けて押して二重に入場した記録 (2026-10 のゲムダン14 までのビルド) は 1 回と数える
        if (b.stageId === undefined || b.stageId !== lastStageId) stageCount += 1;
        lastStageId = b.stageId;
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
        if (typeof b.remainHp === 'number') {
          finalHp = b.remainHp;
          if (b.remainHp <= 0) lastHpZero = true;
        }
        break;
      case 'SessionEnd':
        hasSessionEnd = true;
        sessionResult = b.result;
        break;
    }
  }

  let outcome: RunOutcome;
  if (sessionResult !== undefined) {
    outcome = outcomeFromResult(sessionResult);
  } else if (lastHpZero) {
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

// SessionEnd の result から勝敗を決める。タイトルへ戻った・放置・時間切れ・終了は途中で終わったラン
function outcomeFromResult(result: string): RunOutcome {
  switch (result) {
    case 'Win':
      return 'win';
    case 'Lose':
      return 'loss';
    case 'TutorialClear':
      return 'tutorial';
    default:
      return 'abandoned';
  }
}
