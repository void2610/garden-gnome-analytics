// 1 行を RunEvent に変換する純関数
import {
  KNOWN_EVENT_NAMES,
  RunEventBodySchema,
  type Result,
  type RunEventBody,
  type RunEvent,
  type ParseError,
  ok,
  err,
} from '@gga/shared';
import { tokenizeRunLogLine } from './tokenize';

// ローカル時刻として ISO 文字列を Date に変換
// run ログの timestamp は "2026-05-03T11:23:37.468"（タイムゾーン情報なし）
// new Date(s) は ISO に Z が無いとローカル時刻と解釈される（仕様）
export function parseLocalIsoToDate(iso: string): Date {
  return new Date(iso);
}

// ゲムダン14 当日までの版は使い切り・ターン切れで消えた植物の原因を Unknown と書くので、消えた植物自身を原因にする
function fillPlantRemovalSource(body: RunEventBody): RunEventBody {
  if (body.event !== 'PlantRemoved' || !body.cardName) return body;
  if (body.reason !== 'Triggered' && body.reason !== 'Expired') return body;
  if (body.source && body.source !== 'Unknown') return body;
  return { ...body, source: `Plant:${body.cardName}` };
}

export function parseRunLogLine(line: string, lineNumber = 0): Result<RunEvent, ParseError> {
  const tokens = tokenizeRunLogLine(line);
  if (!tokens) {
    return err({
      kind: 'tokenize',
      line,
      lineNumber,
      message: 'tokenize failed',
    });
  }

  if (!(KNOWN_EVENT_NAMES as readonly string[]).includes(tokens.event)) {
    return err({
      kind: 'unknown_event',
      line,
      lineNumber,
      message: `unknown event: ${tokens.event}`,
    });
  }

  const result = RunEventBodySchema.safeParse({
    event: tokens.event,
    ...tokens.params,
  });

  if (!result.success) {
    return err({
      kind: 'schema',
      line,
      lineNumber,
      message: result.error.message,
      cause: result.error,
    });
  }

  return ok({
    timestamp: tokens.timestamp,
    date: parseLocalIsoToDate(tokens.timestamp),
    body: fillPlantRemovalSource(result.data),
    raw: line,
  });
}
