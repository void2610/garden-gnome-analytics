// runs.parquet と events.parquet, errors.parquet の URL リストを manifest から取得し、
// SQL の FROM 句に流し込めるサブクエリ表現を組み立てる
import {
  errorsAllParquetUrls,
  eventsAllParquetUrls,
  readParquetSql,
  runsAllParquetUrls,
} from '../lib/duckdb/paths';
import type { ManifestDataset } from '../lib/manifest';

export function runsFrom(datasets: ManifestDataset[]): string {
  return readParquetSql(runsAllParquetUrls(datasets));
}

export function eventsFrom(datasets: ManifestDataset[]): string {
  return readParquetSql(eventsAllParquetUrls(datasets));
}

export function errorsFrom(datasets: ManifestDataset[]): string {
  return readParquetSql(errorsAllParquetUrls(datasets));
}
