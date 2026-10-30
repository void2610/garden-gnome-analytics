import { describe, expect, it } from 'vitest';
import { parseRunLogLine } from '../src/runLog/parseLine';

describe('parseRunLogLine', () => {
  it('SessionStart をパースできる', () => {
    const r = parseRunLogLine('2026-05-03T11:23:37.468|SessionStart');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.body.event).toBe('SessionStart');
  });

  it('BattleStart の deckCards を文字列として保持する', () => {
    const r = parseRunLogLine(
      '2026-05-03T11:23:43.347|BattleStart|stageId=Layer0_0_Battle|enemyCount=2|deckCards=Olive(Seed);Fraxinus(Seed)',
    );
    expect(r.ok).toBe(true);
    if (r.ok && r.value.body.event === 'BattleStart') {
      expect(r.value.body.enemyCount).toBe(2);
      expect(r.value.body.deckCards).toBe('Olive(Seed);Fraxinus(Seed)');
    }
  });

  it('PlayerMoved の数値をパースする', () => {
    const r = parseRunLogLine(
      '2026-05-03T11:24:04.727|PlayerMoved|from=7,7|to=7,6|moveDistance=1|remainingMovePoints=3',
    );
    expect(r.ok).toBe(true);
    if (r.ok && r.value.body.event === 'PlayerMoved') {
      expect(r.value.body.from).toBe('7,7');
      expect(r.value.body.moveDistance).toBe(1);
    }
  });

  // ゲームの main が実際に書いている行
  it.each([
    ['2026-10-30T15:02:11.120|ConfusedTurn|turnNumber=3', 'turnNumber', 3],
    ['2026-10-30T15:02:11.120|StageEventLose|eventName=Waterway|optionIndex=1', 'optionIndex', 1],
    ['2026-10-30T15:02:11.120|CardDrawn|cardName=Olive', 'cardName', 'Olive'],
    ['2026-10-30T15:02:11.120|CardDiscarded|cardName=Olive', 'cardName', 'Olive'],
    ['2026-10-30T15:02:11.120|CardExhausted|cardName=Inubarometz', 'cardName', 'Inubarometz'],
    ['2026-10-30T15:02:11.120|EnemyDamaged|enemyName=Slime|damage=4', 'damage', 4],
    ['2026-10-30T15:02:11.120|EnemySpawned|enemyName=Slime', 'enemyName', 'Slime'],
    ['2026-10-30T15:02:11.120|ItemObtained|itemName=Honey', 'itemName', 'Honey'],
    [
      '2026-10-30T15:02:11.120|PlantGrowth|cardName=Olive|oldStage=Seed|newStage=Sprout',
      'newStage',
      'Sprout',
    ],
    ['2026-10-30T15:02:11.120|RelicObtained|relicName=MissileRod', 'relicName', 'MissileRod'],
    ['2026-10-30T15:02:11.120|RelicTriggered|relicName=MissileRod', 'relicName', 'MissileRod'],
  ])('%s を読める', (line, key, expected) => {
    const r = parseRunLogLine(line);
    expect(r.ok).toBe(true);
    if (r.ok) expect((r.value.body as Record<string, unknown>)[key]).toBe(expected);
  });

  it('未知イベントは unknown_event として返す', () => {
    const r = parseRunLogLine('2026-05-03T11:24:04.727|TotallyUnknownEvent|foo=bar');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe('unknown_event');
  });

  it('壊れた行は tokenize エラー', () => {
    const r = parseRunLogLine('not a log line');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe('tokenize');
  });

  it('RewardSelected の choices を文字列で保持', () => {
    const r = parseRunLogLine(
      '2026-05-03T11:25:00.343|RewardSelected|type=Card|selected=Carota|choices=Carota;Siren;Anatifera',
    );
    expect(r.ok).toBe(true);
    if (r.ok && r.value.body.event === 'RewardSelected') {
      expect(r.value.body.selected).toBe('Carota');
      expect(r.value.body.choices).toBe('Carota;Siren;Anatifera');
    }
  });
});
