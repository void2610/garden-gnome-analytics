// public-data/manifest.json を生成
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { EventMeta, Meta } from '@gga/shared';

export interface ManifestDataset {
  eventSlug: string;
  deviceSlug: string;
  meta: Meta;
  // 同一 eventSlug の全 dataset で同じ値が入る。data/<event>/event.yaml の内容。
  eventMeta?: EventMeta;
  runCount: number;
  eventCount: number;
  errorCount: number;
  period: { from: string | null; to: string | null };
  // BattleStart イベントに mapName フィールドが記録されているか。
  // ゲーム側の logging 拡張 (void2610-org/the-garden-of-garden-gnome#192 以降) を
  // 含むビルドのログのみ true。webapp はこのフラグでマップ単位の集計可否を判定する。
  hasMapName: boolean;
}

export interface Manifest {
  generatedAt: string;
  datasets: ManifestDataset[];
}

export async function writeManifest(outDir: string, manifest: Manifest): Promise<void> {
  const path = join(outDir, 'manifest.json');
  await writeFile(path, JSON.stringify(manifest, null, 2), 'utf8');
}
