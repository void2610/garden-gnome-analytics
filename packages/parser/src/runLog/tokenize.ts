// run ログの 1 行をトークン化する純関数
// 例: "2026-05-03T11:23:43.347|BattleStart|stageId=Layer0_0_Battle|enemyCount=2|deckCards=Olive(Seed)"

export interface RunLogTokens {
  timestamp: string;
  event: string;
  params: Record<string, string>;
}

const ISO_RE = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3})$/;

// ゲームは値の中の \ | = 改行を \\ \p \e \n に置き換えて書く (区切りと見分けるため)
const ESCAPES: Record<string, string> = { '\\': '\\', p: '|', e: '=', n: '\n' };

function unescapeValue(value: string): string {
  if (!value.includes('\\')) return value;
  let result = '';
  for (let i = 0; i < value.length; i++) {
    const ch = value[i];
    const next = value[i + 1];
    if (ch === '\\' && next !== undefined && next in ESCAPES) {
      result += ESCAPES[next];
      i++;
    } else {
      result += ch;
    }
  }
  return result;
}

export function tokenizeRunLogLine(line: string): RunLogTokens | null {
  if (line.length === 0) return null;
  const parts = line.split('|');
  if (parts.length < 2) return null;
  const tsRaw = parts[0];
  const event = parts[1];
  if (!tsRaw || !event) return null;
  if (!ISO_RE.test(tsRaw)) return null;

  const params: Record<string, string> = {};
  for (let i = 2; i < parts.length; i++) {
    const seg = parts[i];
    if (!seg) continue;
    const eq = seg.indexOf('=');
    if (eq < 0) continue;
    const key = seg.slice(0, eq);
    const value = unescapeValue(seg.slice(eq + 1));
    params[key] = value;
  }

  return {
    timestamp: tsRaw,
    event,
    params,
  };
}
