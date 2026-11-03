// data/<event>/<device>/meta.yaml を走査し、データセット候補を列挙
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, join, basename } from 'node:path';
import fg from 'fast-glob';
import { parse as parseYaml } from 'yaml';
import { MetaSchema, type Meta, EventMetaSchema, type EventMeta } from '@gga/shared';
import { slugify } from './utils/slugify';

export interface DatasetCandidate {
  meta: Meta;
  metaPath: string;
  dirPath: string;
  // 親 2 階層からデフォルト slug を生成
  defaultEventSlug: string;
  defaultDeviceSlug: string;
  // 上書きを反映した実 slug
  eventSlug: string;
  deviceSlug: string;
  // data/<event>/event.yaml が存在すればその内容
  eventMeta?: EventMeta;
  runLogPaths: string[];
  normalLogPaths: string[];
}

export interface ScanWarning {
  path: string;
  message: string;
}

export interface ScanResult {
  datasets: DatasetCandidate[];
  warnings: ScanWarning[];
}

export async function scanDataDir(dataDir: string): Promise<ScanResult> {
  const datasets: DatasetCandidate[] = [];
  const warnings: ScanWarning[] = [];

  const metaPaths = await fg(['*/*/meta.yaml'], {
    cwd: dataDir,
    onlyFiles: true,
    dot: false,
    absolute: true,
  });

  // event.yaml はイベントディレクトリ単位で 1 度だけ読む。
  // dirPath をキーにキャッシュし、複数機器で共有する。
  const eventMetaCache = new Map<string, EventMeta | undefined>();
  const loadEventMeta = async (eventDir: string): Promise<EventMeta | undefined> => {
    if (eventMetaCache.has(eventDir)) return eventMetaCache.get(eventDir);
    const path = join(eventDir, 'event.yaml');
    try {
      const text = await readFile(path, 'utf8');
      const obj = parseYaml(text);
      const r = EventMetaSchema.safeParse(obj);
      if (!r.success) {
        warnings.push({ path, message: `event.yaml invalid: ${r.error.message}` });
        eventMetaCache.set(eventDir, undefined);
        return undefined;
      }
      eventMetaCache.set(eventDir, r.data);
      return r.data;
    } catch {
      // event.yaml は省略可能
      eventMetaCache.set(eventDir, undefined);
      return undefined;
    }
  };

  for (const metaPath of metaPaths) {
    let meta: Meta;
    try {
      const text = await readFile(metaPath, 'utf8');
      const obj = parseYaml(text);
      const r = MetaSchema.safeParse(obj);
      if (!r.success) {
        warnings.push({ path: metaPath, message: `meta.yaml invalid: ${r.error.message}` });
        continue;
      }
      meta = r.data;
    } catch (e) {
      warnings.push({
        path: metaPath,
        message: `読み込み失敗: ${(e as Error).message}`,
      });
      continue;
    }

    const dirPath = dirname(metaPath);
    const deviceDirName = basename(dirPath);
    const eventDir = dirname(dirPath);
    const eventDirName = basename(eventDir);

    const eventMeta = await loadEventMeta(eventDir);

    const defaultEventSlug = slugify(eventDirName) || slugify(meta.event);
    const defaultDeviceSlug = slugify(deviceDirName) || slugify(meta.device);
    const eventSlug = eventMeta?.slug ?? meta.slug?.event ?? defaultEventSlug;
    const deviceSlug = meta.slug?.device ?? defaultDeviceSlug;

    const runLogPaths = await fg('run_*.log', {
      cwd: dirPath,
      onlyFiles: true,
      absolute: true,
    });
    const normalLogPaths = await fg('the-garden-of-garden-gnome_*.log', {
      cwd: dirPath,
      onlyFiles: true,
      absolute: true,
    });

    datasets.push({
      meta,
      metaPath,
      dirPath,
      defaultEventSlug,
      defaultDeviceSlug,
      eventSlug,
      deviceSlug,
      eventMeta,
      runLogPaths: runLogPaths.sort(),
      normalLogPaths: normalLogPaths.sort(),
    });
  }

  warnings.push(...(await findCopiedLogs(datasets)));
  return { datasets, warnings };
}

// 集めるときに別の機器のログが混ざると、同じランを 2 台で二重に数えるので、中身が同じログを機器をまたいで探す
async function findCopiedLogs(datasets: DatasetCandidate[]): Promise<ScanWarning[]> {
  const firstSeen = new Map<string, { path: string; dirPath: string }>();
  const warnings: ScanWarning[] = [];
  for (const ds of datasets) {
    for (const path of [...ds.runLogPaths, ...ds.normalLogPaths]) {
      const content = await readFile(path);
      if (content.length === 0) continue;
      const hash = createHash('sha256').update(content).digest('hex');
      const seen = firstSeen.get(hash);
      if (!seen) {
        firstSeen.set(hash, { path, dirPath: ds.dirPath });
        continue;
      }
      if (seen.dirPath === ds.dirPath) continue;
      warnings.push({ path, message: `別の機器のフォルダに同じ中身のログがある: ${seen.path}` });
    }
  }
  return warnings;
}
