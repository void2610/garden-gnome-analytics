// run ログのイベント payload を Zod で定義する。キーはゲーム側の Docs/analytics-log-spec.md に合わせる
import { z } from 'zod';

// 文字列パラメータを受け取り、整数化するプリプロセス
const intFromString = z.preprocess((v) => {
  if (typeof v === 'string') {
    const n = Number(v);
    return Number.isFinite(n) ? n : v;
  }
  return v;
}, z.number().int());

const numFromString = z.preprocess((v) => {
  if (typeof v === 'string') {
    const n = Number(v);
    return Number.isFinite(n) ? n : v;
  }
  return v;
}, z.number());

// 共通プレフィックスとして event 名を持つ。スキーマに無いキーも捨てずに文字列のまま残す (ゲーム側で増えた項目を取りこぼさない)
function evt<TName extends string, TShape extends z.ZodRawShape>(name: TName, shape: TShape) {
  return z.object({ event: z.literal(name), ...shape }).passthrough();
}

export const SessionStartSchema = evt('SessionStart', {});
export const SessionEndSchema = evt('SessionEnd', {
  result: z.string().optional(),
  totalTime: z.string().optional(),
  reachedStage: z.string().optional(),
  cause: z.string().optional(),
});

export const StageEnterSchema = evt('StageEnter', {
  stageType: z.string().optional(),
  stageId: z.string().optional(),
});

export const BattleStartSchema = evt('BattleStart', {
  stageId: z.string().optional(),
  mapName: z.string().optional(),
  enemyCount: intFromString.optional(),
  // 文字列のまま保持（後段で parseDeckCards を呼ぶ）
  deckCards: z.string().optional(),
});

export const BattleWinSchema = evt('BattleWin', {
  turnCount: intFromString.optional(),
  remainHp: intFromString.optional(),
  maxHp: intFromString.optional(),
  killedEnemies: intFromString.optional(),
  elapsedTime: z.string().optional(),
});

export const TurnStartSchema = evt('TurnStart', {
  turnNumber: intFromString.optional(),
  hp: intFromString.optional(),
  maxHp: intFromString.optional(),
  cost: intFromString.optional(),
  maxCost: intFromString.optional(),
  block: intFromString.optional(),
  handCount: intFromString.optional(),
});

export const TurnEndSchema = evt('TurnEnd', {
  turnNumber: intFromString.optional(),
  remainingMovePoints: intFromString.optional(),
  remainingCost: intFromString.optional(),
  handCardNames: z.string().optional(),
});

export const PlayerMovedSchema = evt('PlayerMoved', {
  from: z.string().optional(),
  to: z.string().optional(),
  moveDistance: intFromString.optional(),
  remainingMovePoints: intFromString.optional(),
});

export const PlayerHealthChangedSchema = evt('PlayerHealthChanged', {
  hp: intFromString.optional(),
});

export const PlayerDamagedSchema = evt('PlayerDamaged', {
  rawDamage: intFromString.optional(),
  blockedDamage: intFromString.optional(),
  actualDamage: intFromString.optional(),
  remainHp: intFromString.optional(),
  source: z.string().optional(),
});

const CardPlayLikeShape = {
  cardName: z.string().optional(),
  growthStage: z.string().optional(),
  cost: intFromString.optional(),
  target: z.string().optional(),
};
export const CardPlayedSchema = evt('CardPlayed', CardPlayLikeShape);
export const CardCancelledSchema = evt('CardCancelled', CardPlayLikeShape);
export const CardPlayFailedSchema = evt('CardPlayFailed', {
  ...CardPlayLikeShape,
  reason: z.string().optional(),
  requiredCost: intFromString.optional(),
  currentCost: intFromString.optional(),
});

export const PlantPlacedSchema = evt('PlantPlaced', {
  cardName: z.string().optional(),
  position: z.string().optional(),
  direction: z.string().optional(),
  growthStage: z.string().optional(),
});

export const EnemyDefeatedSchema = evt('EnemyDefeated', {
  enemyName: z.string().optional(),
  turnNumber: intFromString.optional(),
});

export const RewardSelectedSchema = evt('RewardSelected', {
  type: z.string().optional(),
  selected: z.string().optional(),
  choices: z.string().optional(),
});

export const ShopBuySchema = evt('ShopBuy', {
  itemType: z.string().optional(),
  itemName: z.string().optional(),
  price: intFromString.optional(),
  remainingCoins: intFromString.optional(),
});

export const ShopExitSchema = evt('ShopExit', {
  purchaseCount: intFromString.optional(),
  remainingCoins: intFromString.optional(),
});

export const RestChoiceSchema = evt('RestChoice', {
  choice: z.string().optional(),
  hpBefore: intFromString.optional(),
  hpAfter: intFromString.optional(),
  maxHp: intFromString.optional(),
});

export const TreasureCollectedSchema = evt('TreasureCollected', {
  position: z.string().optional(),
});

export const StageEventSelectedSchema = evt('StageEventSelected', {
  eventName: z.string().optional(),
  optionIndex: intFromString.optional(),
});

export const CultivationResultSchema = evt('CultivationResult', {
  grownCards: z.string().optional(),
  witheredCards: z.string().optional(),
});

export const ItemUsedSchema = evt('ItemUsed', {
  itemName: z.string().optional(),
});

export const RewardSkippedSchema = evt('RewardSkipped', {
  type: z.string().optional(),
  choices: z.string().optional(),
});

export const BattleLoseSchema = evt('BattleLose', {
  turnCount: intFromString.optional(),
  elapsedTime: z.string().optional(),
});

export const ConfusedTurnSchema = evt('ConfusedTurn', {
  turnNumber: intFromString.optional(),
});

export const StageEventLoseSchema = evt('StageEventLose', {
  eventName: z.string().optional(),
  optionIndex: intFromString.optional(),
});

const CardMoveShape = { cardName: z.string().optional() };
export const CardDrawnSchema = evt('CardDrawn', CardMoveShape);
export const CardDiscardedSchema = evt('CardDiscarded', CardMoveShape);
export const CardExhaustedSchema = evt('CardExhausted', CardMoveShape);

export const EnemyDamagedSchema = evt('EnemyDamaged', {
  enemyName: z.string().optional(),
  damage: intFromString.optional(),
});

export const EnemySpawnedSchema = evt('EnemySpawned', {
  enemyName: z.string().optional(),
});

export const ItemObtainedSchema = evt('ItemObtained', {
  itemName: z.string().optional(),
});

export const PlantGrowthSchema = evt('PlantGrowth', {
  cardName: z.string().optional(),
  oldStage: z.string().optional(),
  newStage: z.string().optional(),
});

export const RelicObtainedSchema = evt('RelicObtained', {
  relicName: z.string().optional(),
});

export const RelicTriggeredSchema = evt('RelicTriggered', {
  relicName: z.string().optional(),
});

export const RUN_EVENT_SCHEMAS = [
  SessionStartSchema,
  SessionEndSchema,
  StageEnterSchema,
  BattleStartSchema,
  BattleWinSchema,
  TurnStartSchema,
  TurnEndSchema,
  PlayerMovedSchema,
  PlayerHealthChangedSchema,
  PlayerDamagedSchema,
  CardPlayedSchema,
  CardCancelledSchema,
  CardPlayFailedSchema,
  PlantPlacedSchema,
  EnemyDefeatedSchema,
  RewardSelectedSchema,
  ShopBuySchema,
  ShopExitSchema,
  RestChoiceSchema,
  TreasureCollectedSchema,
  StageEventSelectedSchema,
  CultivationResultSchema,
  ItemUsedSchema,
  RewardSkippedSchema,
  BattleLoseSchema,
  ConfusedTurnSchema,
  StageEventLoseSchema,
  CardDrawnSchema,
  CardDiscardedSchema,
  CardExhaustedSchema,
  EnemyDamagedSchema,
  EnemySpawnedSchema,
  ItemObtainedSchema,
  PlantGrowthSchema,
  RelicObtainedSchema,
  RelicTriggeredSchema,
] as const;

// 数値文字列を保持するための helper
export { intFromString, numFromString };
