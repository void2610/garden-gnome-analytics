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
