// public-data/manifest.json を生成
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Meta } from '@gga/shared';

export interface ManifestDataset {
  eventSlug: string;
  deviceSlug: string;
  meta: Meta;
  runCount: number;
  eventCount: number;
  errorCount: number;
  period: { from: string | null; to: string | null };
}

export interface Manifest {
  generatedAt: string;
  datasets: ManifestDataset[];
}

export async function writeManifest(outDir: string, manifest: Manifest): Promise<void> {
  const path = join(outDir, 'manifest.json');
  await writeFile(path, JSON.stringify(manifest, null, 2), 'utf8');
}
