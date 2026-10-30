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
  nodeType: z.string().optional(),
  mapName: z.string().optional(),
  enemies: z.string().optional(),
  playerStart: z.string().optional(),
  exits: z.string().optional(),
  treasureCount: intFromString.optional(),
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
  reason: z.string().optional(),
  exitIndex: intFromString.optional(),
  exitNumber: intFromString.optional(),
  exitPosition: z.string().optional(),
  nextNode: z.string().optional(),
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
export const CardPlayedSchema = evt('CardPlayed', {
  ...CardPlayLikeShape,
  kind: z.string().optional(),
  direction: z.string().optional(),
  position: z.string().optional(),
  targets: z.string().optional(),
});
export const CardCancelledSchema = evt('CardCancelled', {
  ...CardPlayLikeShape,
  via: z.string().optional(),
});
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
  enemy: z.string().optional(),
  turnNumber: intFromString.optional(),
  position: z.string().optional(),
  killedBy: z.string().optional(),
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
  item: z.string().optional(),
  how: z.string().optional(),
});

export const TreasureOpenFailedSchema = evt('TreasureOpenFailed', {
  position: z.string().optional(),
  how: z.string().optional(),
});

export const PlantTriggeredSchema = evt('PlantTriggered', {
  cardName: z.string().optional(),
  growthStage: z.string().optional(),
  position: z.string().optional(),
  targets: z.string().optional(),
  remainingTurns: intFromString.optional(),
});

export const PlantRemovedSchema = evt('PlantRemoved', {
  cardName: z.string().optional(),
  growthStage: z.string().optional(),
  position: z.string().optional(),
  reason: z.string().optional(),
  cardDestination: z.string().optional(),
  source: z.string().optional(),
});

export const ObstaclePlacedSchema = evt('ObstaclePlaced', {
  obstacle: z.string().optional(),
  position: z.string().optional(),
  source: z.string().optional(),
});

export const ObstacleRemovedSchema = evt('ObstacleRemoved', {
  obstacle: z.string().optional(),
  position: z.string().optional(),
  reason: z.string().optional(),
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
  cause: z.string().optional(),
});

export const StatusEffectChangedSchema = evt('StatusEffectChanged', {
  target: z.string().optional(),
  type: z.string().optional(),
  change: z.string().optional(),
  delta: intFromString.optional(),
  stacks: intFromString.optional(),
  source: z.string().optional(),
});

export const EnemyDamageTakenSchema = evt('EnemyDamageTaken', {
  enemy: z.string().optional(),
  rawDamage: intFromString.optional(),
  blockedDamage: intFromString.optional(),
  actualDamage: intFromString.optional(),
  remainHp: intFromString.optional(),
  source: z.string().optional(),
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
  enemy: z.string().optional(),
  position: z.string().optional(),
});

export const EnemyIntentSchema = evt('EnemyIntent', {
  turnNumber: intFromString.optional(),
  enemy: z.string().optional(),
  action: z.string().optional(),
  actionType: z.string().optional(),
  values: z.string().optional(),
  position: z.string().optional(),
});

export const EnemyTurnStartSchema = evt('EnemyTurnStart', {
  turnNumber: intFromString.optional(),
  aliveEnemies: intFromString.optional(),
});

export const EnemyMovedSchema = evt('EnemyMoved', {
  enemy: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

export const EnemyActionSchema = evt('EnemyAction', {
  enemy: z.string().optional(),
  action: z.string().optional(),
  actionType: z.string().optional(),
  position: z.string().optional(),
  // C# の bool を ToString した True / False
  playerInRange: z.string().optional(),
  hp: intFromString.optional(),
  block: intFromString.optional(),
  values: z.string().optional(),
});

export const EnemyActionInterruptedSchema = evt('EnemyActionInterrupted', {
  enemy: z.string().optional(),
  action: z.string().optional(),
  reason: z.string().optional(),
});

export const EnemyTurnSkippedSchema = evt('EnemyTurnSkipped', {
  enemy: z.string().optional(),
  reason: z.string().optional(),
});

export const EnemyConfusedSchema = evt('EnemyConfused', {
  enemy: z.string().optional(),
});

export const EnemySelectedSchema = evt('EnemySelected', {
  enemy: z.string().optional(),
});

export const EnemySelectionCancelledSchema = evt('EnemySelectionCancelled', {});

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

export const TurnSkippedSchema = evt('TurnSkipped', {
  turnNumber: intFromString.optional(),
  reason: z.string().optional(),
});

export const DeckReshuffledSchema = evt('DeckReshuffled', {
  cardCount: intFromString.optional(),
});

export const CardBlockedSchema = evt('CardBlocked', {
  cardName: z.string().optional(),
  reason: z.string().optional(),
});

export const HandCardSelectedSchema = evt('HandCardSelected', {
  selectionType: z.string().optional(),
  cardName: z.string().optional(),
});

export const HandCardSelectionSkippedSchema = evt('HandCardSelectionSkipped', {
  selectionType: z.string().optional(),
});

export const MapStructureSchema = evt('MapStructure', {
  source: z.string().optional(),
  current: z.string().optional(),
  visited: z.string().optional(),
  nodes: z.string().optional(),
  edges: z.string().optional(),
});

export const NodeSelectedSchema = evt('NodeSelected', {
  stageId: z.string().optional(),
  available: z.string().optional(),
});

export const StageCompletedSchema = evt('StageCompleted', {
  stageId: z.string().optional(),
  exitIndex: intFromString.optional(),
  unlocked: z.string().optional(),
});

const RewardCandidatesShape = { cards: z.string().optional(), relic: z.string().optional() };
export const RewardOfferedSchema = evt('RewardOffered', {
  coinReward: intFromString.optional(),
  nutritionReward: intFromString.optional(),
  ...RewardCandidatesShape,
});
export const RewardSelectionOpenedSchema = evt('RewardSelectionOpened', RewardCandidatesShape);

export const ShopOpenedSchema = evt('ShopOpened', {
  cards: z.string().optional(),
  relics: z.string().optional(),
  items: z.string().optional(),
  bookCovers: z.string().optional(),
  removalPrice: intFromString.optional(),
  randomCardPrice: intFromString.optional(),
  randomRelicPrice: intFromString.optional(),
  randomItemPrice: intFromString.optional(),
  discountPercent: intFromString.optional(),
  coins: intFromString.optional(),
});

export const ShopBuyFailedSchema = evt('ShopBuyFailed', {
  itemType: z.string().optional(),
  itemName: z.string().optional(),
  price: intFromString.optional(),
  reason: z.string().optional(),
});

export const ShopRemoveCancelledSchema = evt('ShopRemoveCancelled', {
  price: intFromString.optional(),
});

export const TreasureNodeOfferedSchema = evt('TreasureNodeOffered', {
  relic: z.string().optional(),
  cost: intFromString.optional(),
  currentTime: intFromString.optional(),
  canOpen: z.string().optional(),
});

export const TreasureNodeOpenedSchema = evt('TreasureNodeOpened', {
  relic: z.string().optional(),
  cost: intFromString.optional(),
  obtained: z.string().optional(),
});

export const TreasureNodeSkippedSchema = evt('TreasureNodeSkipped', {
  relic: z.string().optional(),
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
  StatusEffectChangedSchema,
  EnemyDamageTakenSchema,
  EnemyIntentSchema,
  EnemyTurnStartSchema,
  EnemyMovedSchema,
  EnemyActionSchema,
  EnemyActionInterruptedSchema,
  EnemyTurnSkippedSchema,
  EnemyConfusedSchema,
  EnemySelectedSchema,
  EnemySelectionCancelledSchema,
  TurnSkippedSchema,
  DeckReshuffledSchema,
  CardBlockedSchema,
  HandCardSelectedSchema,
  HandCardSelectionSkippedSchema,
  TreasureOpenFailedSchema,
  PlantTriggeredSchema,
  PlantRemovedSchema,
  ObstaclePlacedSchema,
  ObstacleRemovedSchema,
  MapStructureSchema,
  NodeSelectedSchema,
  StageCompletedSchema,
  RewardOfferedSchema,
  RewardSelectionOpenedSchema,
  ShopOpenedSchema,
  ShopBuyFailedSchema,
  ShopRemoveCancelledSchema,
  TreasureNodeOfferedSchema,
  TreasureNodeOpenedSchema,
  TreasureNodeSkippedSchema,
] as const;

// 数値文字列を保持するための helper
export { intFromString, numFromString };
