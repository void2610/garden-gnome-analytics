// public-data/manifest.json を取得する
import { z } from 'zod';
import { manifestUrl } from './duckdb/paths';

export const ManifestDatasetSchema = z.object({
  eventSlug: z.string(),
  deviceSlug: z.string(),
  meta: z.object({
    event: z.string(),
    event_date: z.string().optional(),
    venue: z.string().optional(),
    device: z.string(),
    game_version: z.string().optional(),
    notes: z.string().optional(),
  }),
  runCount: z.number(),
  eventCount: z.number(),
  errorCount: z.number(),
  period: z.object({
    from: z.string().nullable(),
    to: z.string().nullable(),
  }),
  // BattleStart に mapName が記録されているか (古いログでは欠ける)
  hasMapName: z.boolean().optional().default(false),
});

export const ManifestSchema = z.object({
  generatedAt: z.string(),
  datasets: z.array(ManifestDatasetSchema),
});

export type Manifest = z.infer<typeof ManifestSchema>;
export type ManifestDataset = z.infer<typeof ManifestDatasetSchema>;

export async function fetchManifest(): Promise<Manifest> {
  const res = await fetch(manifestUrl());
  if (!res.ok) throw new Error(`manifest fetch failed: ${res.status}`);
  const json = await res.json();
  return ManifestSchema.parse(json);
}
