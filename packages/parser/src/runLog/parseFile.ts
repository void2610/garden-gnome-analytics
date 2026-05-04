// ファイル全体をストリームでパースする
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import type { RunEvent, ParseError } from '@gga/shared';
import { parseRunLogLine } from './parseLine';

export interface RunFileParseOptions {
  // パース失敗時にエラーを呼び出し側に流す（既定では warn してスキップ）
  onError?: (error: ParseError) => void;
}

export async function* parseRunLogFile(
  filePath: string,
  options: RunFileParseOptions = {},
): AsyncGenerator<RunEvent, void, unknown> {
  const stream = createReadStream(filePath, { encoding: 'utf8' });
  const rl = createInterface({ input: stream, crlfDelay: Number.POSITIVE_INFINITY });
  let lineNumber = 0;
  for await (const rawLine of rl) {
    lineNumber += 1;
    const line = rawLine.replace(/\r$/, '');
    if (line.length === 0) continue;
    const result = parseRunLogLine(line, lineNumber);
    if (!result.ok) {
      options.onError?.(result.error);
      continue;
    }
    yield result.value;
  }
}

// 配列で全件取得（小ファイル用ヘルパ）
export async function parseRunLogFileToArray(
  filePath: string,
  options: RunFileParseOptions = {},
): Promise<RunEvent[]> {
  const out: RunEvent[] = [];
  for await (const ev of parseRunLogFile(filePath, options)) out.push(ev);
  return out;
}
