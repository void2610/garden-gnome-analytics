// イベントペイロード内の値を JS の値に変換するヘルパ群
import { z } from 'zod';

// "7,6" → { x: 7, y: 6 }
export const PositionSchema = z.object({
  x: z.number().int(),
  y: z.number().int(),
});
export type Position = z.infer<typeof PositionSchema>;

export function parsePosition(raw: string): Position {
  const [xStr, yStr] = raw.split(',');
  if (xStr === undefined || yStr === undefined) {
    throw new Error(`invalid position: ${raw}`);
  }
  const x = Number(xStr);
  const y = Number(yStr);
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`invalid position numbers: ${raw}`);
  }
  return { x, y };
}

// "Olive(Seed);Fraxinus(Seed)" を分解
export const DeckCardSchema = z.object({
  cardName: z.string(),
  growthStage: z.string(),
});
export type DeckCard = z.infer<typeof DeckCardSchema>;

export function parseDeckCards(raw: string): DeckCard[] {
  if (raw.length === 0) return [];
  return raw
    .split(';')
    .filter((s) => s.length > 0)
    .map(parseDeckCard);
}

export function parseDeckCard(raw: string): DeckCard {
  const m = raw.match(/^(.+?)\(([^)]+)\)$/);
  if (!m) {
    // フォールバック: 括弧無しなら growthStage 不明
    return { cardName: raw, growthStage: 'Unknown' };
  }
  const cardName = m[1] ?? raw;
  const growthStage = m[2] ?? 'Unknown';
  return { cardName, growthStage };
}

// "62.3s" → 62.3 (秒)
export function parseElapsedTime(raw: string): number {
  const trimmed = raw.endsWith('s') ? raw.slice(0, -1) : raw;
  const n = Number(trimmed);
  if (!Number.isFinite(n)) throw new Error(`invalid elapsedTime: ${raw}`);
  return n;
}

// 文字列リスト ("a;b;c") を配列に
export function parseStringList(raw: string): string[] {
  if (raw.length === 0) return [];
  return raw.split(';').filter((s) => s.length > 0);
}
