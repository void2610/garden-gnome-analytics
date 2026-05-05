import { z } from 'zod';

// data/<event>/<device>/meta.yaml の Zod スキーマ
export const MetaSchema = z.object({
  event: z.string(),
  event_date: z.string().or(z.date()).optional(),
  venue: z.string().optional(),
  device: z.string(),
  game_version: z.string().optional(),
  notes: z.string().optional(),
  // 任意で slug を上書き可能
  slug: z
    .object({
      event: z.string().optional(),
      device: z.string().optional(),
    })
    .optional(),
});

export type Meta = z.infer<typeof MetaSchema>;

// data/<event>/event.yaml のスキーマ。
// イベント全体に紐付くメモを記述するためのオプションファイル。
export const EventMetaSchema = z.object({
  // 表示名 (省略時は配下の meta.yaml の event を採用)
  name: z.string().optional(),
  description: z.string().optional(),
  // 任意で slug を上書き可能
  slug: z.string().optional(),
  // イベントの開催時間帯 (JST, "HH:MM"-"HH:MM")。
  // ingest 時に started_at が [start, end) の範囲外のランは除外される。
  // 開発者によるテストプレイを分析対象から外すために使う。
  play_hours: z
    .object({
      start: z.string().regex(/^\d{2}:\d{2}$/),
      end: z.string().regex(/^\d{2}:\d{2}$/),
    })
    .optional(),
});

export type EventMeta = z.infer<typeof EventMetaSchema>;
