import { z } from 'zod';
import { RUN_EVENT_SCHEMAS } from './payloads';

type RunEventSchema = (typeof RUN_EVENT_SCHEMAS)[number];

// イベント本体に共通する timestamp などは外側で持つ
export const RunEventBodySchema = z.discriminatedUnion(
  'event',
  RUN_EVENT_SCHEMAS as unknown as [RunEventSchema, ...RunEventSchema[]],
);

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
