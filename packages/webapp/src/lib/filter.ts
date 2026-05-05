// 共通フィルタの Zod スキーマ
// URL search params で型安全に扱うため string 配列の最小スキーマ
import { z } from 'zod';
import { TableFilterSchema, TableSortSchema } from './tableQuery';

export const FilterSchema = z.object({
  events: z.array(z.string()).optional(),
  devices: z.array(z.string()).optional(),
  // YYYY-MM-DD
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  // テーブル単位のフィルタ / ソート (列に対する自由フィルタ + 複数キーソート)
  // 詳細は lib/tableQuery.ts
  tf: z.array(TableFilterSchema).optional(),
  ts: z.array(TableSortSchema).optional(),
});

export type Filter = z.infer<typeof FilterSchema>;

export function emptyFilter(): Filter {
  return {};
}

// SQL の WHERE 句を組み立てる（プリペアドではなく文字列リテラル化、フィルタ値は slug/日付のみで安全）
export function buildWhere(filter: Filter, alias?: string): string {
  const a = alias ? `${alias}.` : '';
  const conds: string[] = [];
  if (filter.events && filter.events.length > 0) {
    const list = filter.events.map((s) => `'${s.replace(/'/g, "''")}'`).join(',');
    conds.push(`${a}event_slug IN (${list})`);
  }
  if (filter.devices && filter.devices.length > 0) {
    const list = filter.devices.map((s) => `'${s.replace(/'/g, "''")}'`).join(',');
    conds.push(`${a}device_slug IN (${list})`);
  }
  if (filter.dateFrom) {
    conds.push(`${a}timestamp >= TIMESTAMP '${filter.dateFrom} 00:00:00'`);
  }
  if (filter.dateTo) {
    conds.push(`${a}timestamp <= TIMESTAMP '${filter.dateTo} 23:59:59'`);
  }
  return conds.length === 0 ? '' : `WHERE ${conds.join(' AND ')}`;
}

// runs.parquet 用 (started_at/ended_at)
export function buildWhereRuns(filter: Filter): string {
  const conds: string[] = [];
  if (filter.events && filter.events.length > 0) {
    const list = filter.events.map((s) => `'${s.replace(/'/g, "''")}'`).join(',');
    conds.push(`event_slug IN (${list})`);
  }
  if (filter.devices && filter.devices.length > 0) {
    const list = filter.devices.map((s) => `'${s.replace(/'/g, "''")}'`).join(',');
    conds.push(`device_slug IN (${list})`);
  }
  if (filter.dateFrom) {
    conds.push(`started_at >= TIMESTAMP '${filter.dateFrom} 00:00:00'`);
  }
  if (filter.dateTo) {
    conds.push(`started_at <= TIMESTAMP '${filter.dateTo} 23:59:59'`);
  }
  return conds.length === 0 ? '' : `WHERE ${conds.join(' AND ')}`;
}
