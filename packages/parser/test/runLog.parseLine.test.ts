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

  // ゲーム側の原因の記録 (the-garden-of-garden-gnome #613・#614)
  it.each([
    [
      '2026-10-30T15:02:11.120|PlayerDamaged|rawDamage=5|blockedDamage=2|actualDamage=3|remainHp=40|source=Enemy:TestEnemyAttacker#0',
      'source',
      'Enemy:TestEnemyAttacker#0',
    ],
    [
      '2026-10-30T15:02:11.120|StatusEffectChanged|target=Player|type=Poison|change=Reduced|delta=-1|stacks=1|source=TurnStart',
      'delta',
      -1,
    ],
    [
      '2026-10-30T15:02:11.120|EnemyDamageTaken|enemy=Slime#1|rawDamage=6|blockedDamage=0|actualDamage=6|remainHp=6|source=Card:Olive',
      'actualDamage',
      6,
    ],
    [
      '2026-10-30T15:02:11.120|EnemyDefeated|enemy=Slime#1|turnNumber=2|position=4,7|killedBy=Status:Poison',
      'killedBy',
      'Status:Poison',
    ],
    [
      '2026-10-30T15:02:11.120|BattleLose|turnCount=4|elapsedTime=31.2s|cause=Enemy:Shiroikona#0',
      'cause',
      'Enemy:Shiroikona#0',
    ],
  ])('%s を読める', (line, key, expected) => {
    const r = parseRunLogLine(line);
    expect(r.ok).toBe(true);
    if (r.ok) expect((r.value.body as Record<string, unknown>)[key]).toBe(expected);
  });

  // ゲーム側の敵のターンの記録 (the-garden-of-garden-gnome #620)
  it.each([
    [
      '2026-10-30T16:12:39.220|EnemyIntent|turnNumber=1|enemy=Aohaacari#0|action=AttackAndBlock|actionType=AttackAndBlockAction|values=Damage:5;Block:10|position=4,4',
      'values',
      'Damage:5;Block:10',
    ],
    ['2026-10-30T16:59:36.152|EnemyTurnStart|turnNumber=1|aliveEnemies=1', 'aliveEnemies', 1],
    ['2026-10-30T15:57:10.307|EnemyMoved|enemy=Mochinoha#2|from=4,6|to=5,6', 'to', '5,6'],
    [
      '2026-10-30T16:59:36.152|EnemyAction|enemy=TestEnemyAttacker#0|action=SimpleAttack|actionType=SimpleAttackAction|position=6,7|playerInRange=True|hp=9999|block=0|values=Damage:5',
      'hp',
      9999,
    ],
    [
      '2026-10-30T16:59:36.152|EnemyActionInterrupted|enemy=Slime#0|action=SimpleAttack|reason=Died',
      'reason',
      'Died',
    ],
    [
      '2026-10-30T16:05:56.263|EnemyTurnSkipped|enemy=TestEnemyInvulnerable#0|reason=Sleep',
      'reason',
      'Sleep',
    ],
    ['2026-10-30T16:05:56.263|EnemyConfused|enemy=Slime#0', 'enemy', 'Slime#0'],
    ['2026-10-30T16:59:14.614|EnemySelected|enemy=Aohaacari#0', 'enemy', 'Aohaacari#0'],
    ['2026-10-30T16:59:14.614|EnemySpawned|enemy=Aohaacari#0|position=4,4', 'position', '4,4'],
  ])('%s を読める', (line, key, expected) => {
    const r = parseRunLogLine(line);
    expect(r.ok).toBe(true);
    if (r.ok) expect((r.value.body as Record<string, unknown>)[key]).toBe(expected);
  });

  it('EnemySelectionCancelled はキーが無くても読める', () => {
    expect(parseRunLogLine('2026-10-30T16:59:14.614|EnemySelectionCancelled').ok).toBe(true);
  });

  // ゲーム側の戦闘の流れとカードの記録 (the-garden-of-garden-gnome #621)
  it.each([
    [
      '2026-10-30T16:12:39.216|BattleStart|stageId=Layer0_0_Battle|nodeType=Battle|mapName=fixed_stairs_behind_enemy|enemyCount=1|enemies=Aohaacari#0@4,4|playerStart=3,4|exits=1@0,6>Layer1_0_Event|treasureCount=0|deckCards=Olive(Seed)',
      'treasureCount',
      0,
    ],
    [
      '2026-10-30T16:36:17.600|BattleWin|turnCount=3|remainHp=80|maxHp=100|killedEnemies=2|elapsedTime=40.1s|reason=Exit|exitIndex=0|exitNumber=1|exitPosition=0,6|nextNode=Layer1_0_Event',
      'exitNumber',
      1,
    ],
    ['2026-10-30T16:57:30.357|TurnSkipped|turnNumber=3|reason=Sleep', 'reason', 'Sleep'],
    ['2026-10-30T16:57:30.175|DeckReshuffled|cardCount=12', 'cardCount', 12],
    [
      '2026-10-30T16:57:49.520|CardPlayed|cardName=Olive|growthStage=Bloom|cost=3|kind=direction|direction=Left|position=7,7|targets=Aohaacari#0@4,7',
      'targets',
      'Aohaacari#0@4,7',
    ],
    ['2026-10-30T16:57:30.194|CardBlocked|cardName=Olive|reason=Sealed', 'reason', 'Sealed'],
    ['2026-10-30T16:57:30.194|CardCancelled|cardName=Olive|via=HandClick', 'via', 'HandClick'],
    [
      '2026-10-30T16:11:49.793|HandCardSelected|selectionType=Exhaust|cardName=Fraxinus(Seed)',
      'cardName',
      'Fraxinus(Seed)',
    ],
    [
      '2026-10-30T16:57:29.873|HandCardSelectionSkipped|selectionType=Exhaust',
      'selectionType',
      'Exhaust',
    ],
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
