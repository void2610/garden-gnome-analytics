// public-data 配下の Parquet パスを解決する
// 開発時/本番ともに base URL を経由した URL を返す

const BASE = import.meta.env.BASE_URL || '/';

function withBase(path: string): string {
  if (BASE.endsWith('/') && path.startsWith('/')) return BASE + path.slice(1);
  if (!BASE.endsWith('/') && !path.startsWith('/')) return `${BASE}/${path}`;
  return BASE + path;
}

export function manifestUrl(): string {
  return withBase('manifest.json');
}

// SQL の中で使うため URL ではなく相対パスとして扱う場合がある
// DuckDB-Wasm の httpfs では完全な URL を要求するため、ここでは absolute URL を返す
export function eventsParquetUrl(eventSlug: string, deviceSlug: string): string {
  return withBase(`events/event=${eventSlug}/device=${deviceSlug}/data.parquet`);
}

export function runsParquetUrl(eventSlug: string, deviceSlug: string): string {
  return withBase(`runs/event=${eventSlug}/device=${deviceSlug}/data.parquet`);
}

export function errorsParquetUrl(eventSlug: string, deviceSlug: string): string {
  return withBase(`errors/event=${eventSlug}/device=${deviceSlug}/data.parquet`);
}

// 全パーティション一括の glob パターン (DuckDB-Wasm の httpfs はワイルドカード非対応のため、
// クエリ層では manifest を見て個別 URL の UNION ALL を組む)
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
  if (urls.length === 0) return "(SELECT NULL WHERE FALSE)";
  const list = urls.map((u) => `'${u.replace(/'/g, "''")}'`).join(', ');
  return `read_parquet([${list}], union_by_name=true)`;
}
