import { describe, expect, it } from 'vitest';
import { slugify } from './slugify';

describe('slugify', () => {
  it('英大文字小文字を正規化', () => {
    expect(slugify('MacBook Pro 14"')).toBe('macbook-pro-14');
  });
  it('日本語は - に', () => {
    expect(slugify('ゲムダン12 デモ展示')).toBe('12');
  });
  it('全角空白', () => {
    expect(slugify('a　b')).toBe('a-b');
  });
});
