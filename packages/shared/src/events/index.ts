import { z } from 'zod';
import { RUN_EVENT_SCHEMAS } from './payloads';

// イベント本体に共通する timestamp などは外側で持つ
export const RunEventBodySchema = z.discriminatedUnion('event', [
  RUN_EVENT_SCHEMAS[0],
  RUN_EVENT_SCHEMAS[1],
  RUN_EVENT_SCHEMAS[2],
  RUN_EVENT_SCHEMAS[3],
  RUN_EVENT_SCHEMAS[4],
  RUN_EVENT_SCHEMAS[5],
  RUN_EVENT_SCHEMAS[6],
  RUN_EVENT_SCHEMAS[7],
  RUN_EVENT_SCHEMAS[8],
  RUN_EVENT_SCHEMAS[9],
  RUN_EVENT_SCHEMAS[10],
  RUN_EVENT_SCHEMAS[11],
  RUN_EVENT_SCHEMAS[12],
  RUN_EVENT_SCHEMAS[13],
  RUN_EVENT_SCHEMAS[14],
  RUN_EVENT_SCHEMAS[15],
  RUN_EVENT_SCHEMAS[16],
  RUN_EVENT_SCHEMAS[17],
  RUN_EVENT_SCHEMAS[18],
  RUN_EVENT_SCHEMAS[19],
  RUN_EVENT_SCHEMAS[20],
  RUN_EVENT_SCHEMAS[21],
]);

export type RunEventBody = z.infer<typeof RunEventBodySchema>;

// timestamp 付きの 1 ログ行を表す型
export interface RunEvent {
  // ログ行の ISO8601 (ローカル時刻) をそのまま保持
  timestamp: string;
  // パース後の Date（ローカル解釈）
  date: Date;
  // discriminated union 本体
  body: RunEventBody;
  // 元の生行（デバッグ用）
  raw: string;
}

export * from './eventName';
export * from './payloads';
export * from './converters';
