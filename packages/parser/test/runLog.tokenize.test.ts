import { describe, expect, it } from 'vitest';
import { tokenizeRunLogLine } from '../src/runLog/tokenize';

describe('tokenizeRunLogLine', () => {
  it('ゲームがエスケープした値の \\ | = 改行を元に戻す', () => {
    const tokens = tokenizeRunLogLine(
      '2026-10-29T10:12:05.012|SessionEnd|cause=a\\pb\\ec\\\\d\\ne',
    );
    expect(tokens?.params.cause).toBe('a|b=c\\d\ne');
  });

  it('エスケープの対象でない \\ の後ろの文字はそのまま残す', () => {
    const tokens = tokenizeRunLogLine('2026-10-29T10:12:05.012|SessionEnd|cause=a\\xb');
    expect(tokens?.params.cause).toBe('a\\xb');
  });
});
