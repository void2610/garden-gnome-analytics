import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseNormalLogFile } from '../src/normalLog/parseFile';
import { parseNormalLogChunk } from '../src/normalLog/parseChunk';

const here = dirname(fileURLToPath(import.meta.url));
const fixtureDir = join(here, 'fixtures');

describe('parseNormalLogChunk', () => {
  it('1 行のログ entry をパースする', () => {
    const entries = parseNormalLogChunk('2026-05-03 10:29:28.924 [LogManager] Initialized\n');
    expect(entries).toHaveLength(1);
    expect(entries[0]?.level).toBe('LogManager');
    expect(entries[0]?.message).toBe('Initialized');
  });

  it('Exception のスタックトレースを連結する', () => {
    const text = `2026-05-03 10:47:56.069 [Exception] NullReferenceException: foo
StackTrace line 1
StackTrace line 2

2026-05-03 10:48:00.000 [Log] next entry
`;
    const entries = parseNormalLogChunk(text);
    expect(entries).toHaveLength(2);
    expect(entries[0]?.level).toBe('Exception');
    expect(entries[0]?.stackTrace).toContain('StackTrace line 1');
    expect(entries[0]?.stackTrace).toContain('StackTrace line 2');
    expect(entries[1]?.message).toBe('next entry');
  });
});

describe('parseNormalLogFile', () => {
  it('fixture を読み込める', async () => {
    const entries = await parseNormalLogFile(join(fixtureDir, 'normal-with-exception.log'));
    expect(entries.length).toBeGreaterThan(0);
    const exc = entries.find((e) => e.level === 'Exception');
    expect(exc).toBeDefined();
    expect(exc?.stackTrace).toContain('GardenGnome');
  });
});
