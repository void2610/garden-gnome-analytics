// public-data 配下の Parquet パスを解決する
// DuckDB-Wasm の httpfs は absolute URL を要求するため、必ず origin を付ける

const BASE = import.meta.env.BASE_URL || '/';
// SSR 時 (vitest) は origin を空文字でフォールバック
const ORIGIN = typeof window !== 'undefined' ? window.location.origin : '';

function withOrigin(path: string): string {
  let p = path;
  if (BASE.endsWith('/') && p.startsWith('/')) p = BASE + p.slice(1);
  else if (!BASE.endsWith('/') && !p.startsWith('/')) p = `${BASE}/${p}`;
  else p = BASE + p;
  return ORIGIN + p;
}

export function manifestUrl(): string {
  // manifest は fetch() で取得するので origin 無しでも問題ないが、揃えておく
  return withOrigin('manifest.json');
}

export function eventsParquetUrl(eventSlug: string, deviceSlug: string): string {
  return withOrigin(`events/event=${eventSlug}/device=${deviceSlug}/data.parquet`);
}

export function runsParquetUrl(eventSlug: string, deviceSlug: string): string {
  return withOrigin(`runs/event=${eventSlug}/device=${deviceSlug}/data.parquet`);
}

export function errorsParquetUrl(eventSlug: string, deviceSlug: string): string {
  return withOrigin(`errors/event=${eventSlug}/device=${deviceSlug}/data.parquet`);
}

export function eventsAllParquetUrls(
  datasets: Array<{ eventSlug: string; deviceSlug: string }>,
): string[] {
  return datasets.map((d) => eventsParquetUrl(d.eventSlug, d.deviceSlug));
}

export function runsAllParquetUrls(
  datasets: Array<{ eventSlug: string; deviceSlug: string }>,
): string[] {
  return datasets.map((d) => runsParquetUrl(d.eventSlug, d.deviceSlug));
}

export function errorsAllParquetUrls(
  datasets: Array<{ eventSlug: string; deviceSlug: string }>,
): string[] {
  return datasets.map((d) => errorsParquetUrl(d.eventSlug, d.deviceSlug));
}

// SQL で複数 Parquet を読む際の擬似 read_parquet(['url1','url2']) を組み立てる
export function readParquetSql(urls: string[]): string {
  if (urls.length === 0) return '(SELECT NULL WHERE FALSE)';
  const list = urls.map((u) => `'${u.replace(/'/g, "''")}'`).join(', ');
  return `read_parquet([${list}], union_by_name=true)`;
}
