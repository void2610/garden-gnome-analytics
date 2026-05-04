import { z } from 'zod';

// 設計ドキュメントに記載された 21 種のイベント
export const EventNameSchema = z.enum([
  'SessionStart',
  'SessionEnd',
  'StageEnter',
  'BattleStart',
  'BattleWin',
  'TurnStart',
  'TurnEnd',
  'PlayerMoved',
  'PlayerHealthChanged',
  'PlayerDamaged',
  'CardPlayed',
  'CardCancelled',
  'CardPlayFailed',
  'PlantPlaced',
  'EnemyDefeated',
  'RewardSelected',
  'ShopBuy',
  'ShopExit',
  'RestChoice',
  'TreasureCollected',
  'StageEventSelected',
  'CultivationResult',
]);

export type EventName = z.infer<typeof EventNameSchema>;

export const KNOWN_EVENT_NAMES: ReadonlyArray<EventName> = EventNameSchema.options;
