import { describe, expect, it } from 'vitest';
import {
  parseDeckCard,
  parseDeckCards,
  parseElapsedTime,
  parsePosition,
  parseStringList,
} from './events/converters';
import { MetaSchema } from './meta';

describe('parsePosition', () => {
  it('"7,6" → {x:7,y:6}', () => {
    expect(parsePosition('7,6')).toEqual({ x: 7, y: 6 });
  });
});

describe('parseDeckCard', () => {
  it('括弧つきのカードを分解', () => {
    expect(parseDeckCard('Olive(Seed)')).toEqual({
      cardName: 'Olive',
      growthStage: 'Seed',
    });
  });
  it('括弧なしは Unknown', () => {
    expect(parseDeckCard('Olive')).toEqual({
      cardName: 'Olive',
      growthStage: 'Unknown',
    });
  });
});

describe('parseDeckCards', () => {
  it('複数カードを分解', () => {
    expect(parseDeckCards('Olive(Seed);Fraxinus(Sprout)')).toEqual([
      { cardName: 'Olive', growthStage: 'Seed' },
      { cardName: 'Fraxinus', growthStage: 'Sprout' },
    ]);
  });
});

describe('parseElapsedTime', () => {
  it('"62.3s" → 62.3', () => {
    expect(parseElapsedTime('62.3s')).toBeCloseTo(62.3);
  });
});

describe('parseStringList', () => {
  it('空文字は []', () => {
    expect(parseStringList('')).toEqual([]);
  });
  it('セミコロン区切りを分解', () => {
    expect(parseStringList('a;b;c')).toEqual(['a', 'b', 'c']);
  });
});

describe('MetaSchema', () => {
  it('event/device があれば通る', () => {
    const r = MetaSchema.safeParse({ event: 'demo', device: 'mac' });
    expect(r.success).toBe(true);
  });
  it('event を欠くと失敗', () => {
    const r = MetaSchema.safeParse({ device: 'mac' });
    expect(r.success).toBe(false);
  });
});
