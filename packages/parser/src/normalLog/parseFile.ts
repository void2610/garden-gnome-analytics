// 通常ログをファイルから読んで NormalLogEntry[] を返す
import { readFile } from 'node:fs/promises';
import type { NormalLogEntry } from '@gga/shared';
import { parseNormalLogChunk } from './parseChunk';

export async function parseNormalLogFile(filePath: string): Promise<NormalLogEntry[]> {
  const text = await readFile(filePath, 'utf8');
  return parseNormalLogChunk(text);
}
