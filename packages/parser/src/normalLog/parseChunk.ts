// 通常ログ (a) の text 全体を NormalLogEntry[] にする純関数
import type { NormalLogEntry, NormalLogLevel } from '@gga/shared';

const LINE_HEAD =
  /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}\.\d{3}) \[([^\]]+)\]\s?(.*)$/;

const LEVELS: ReadonlyArray<NormalLogLevel> = [
  'Log',
  'Error',
  'Exception',
  'LogManager',
  'Warning',
];

function isLevel(s: string): s is NormalLogLevel {
  return (LEVELS as readonly string[]).includes(s);
}

export function parseNormalLogChunk(text: string): NormalLogEntry[] {
  const lines = text.split(/\r?\n/);
  const entries: NormalLogEntry[] = [];
  let current: NormalLogEntry | null = null;
  const stackBuf: string[] = [];

  function flush() {
    if (!current) return;
    if (stackBuf.length > 0) {
      current.stackTrace = stackBuf.join('\n');
    }
    entries.push(current);
    current = null;
    stackBuf.length = 0;
  }

  for (const line of lines) {
    const m = line.match(LINE_HEAD);
    if (m) {
      flush();
      const [, dateStr, timeStr, levelStr, message] = m;
      const level = levelStr && isLevel(levelStr) ? levelStr : 'Log';
      const ts = `${dateStr}T${timeStr}`;
      current = {
        timestamp: ts,
        date: new Date(ts),
        level,
        message: (message ?? '').trim(),
      };
    } else if (current) {
      // 直前のエントリのスタックトレースとして連結
      if (line.length > 0 || stackBuf.length > 0) {
        stackBuf.push(line);
      }
    }
  }
  flush();
  return entries;
}
