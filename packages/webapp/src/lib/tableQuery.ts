// テーブル単位のフィルタ / ソート条件 (URL search に乗せる前提のスキーマ)
//
// グローバルな FilterBar (events / devices / dateFrom / dateTo) とは責務を分けて、
// 「テーブルの列に対する自由フィルタ」と「複数キーソート」をひとまとめにする。
import { z } from 'zod';

export const TABLE_FILTER_OPS = ['eq', 'neq', 'contains', 'gt', 'gte', 'lt', 'lte'] as const;
export type TableFilterOp = (typeof TABLE_FILTER_OPS)[number];

// ユーザに見せる演算子ラベル
export const TABLE_FILTER_OP_LABEL: Record<TableFilterOp, string> = {
  eq: '=',
  neq: '≠',
  contains: '含む',
  gt: '>',
  gte: '≥',
  lt: '<',
  lte: '≤',
};

export const TableFilterSchema = z.object({
  // 列の key (SortableColumn.key と一致)
  field: z.string(),
  op: z.enum(TABLE_FILTER_OPS),
  // 値はすべて文字列で持つ。数値判定が必要な op は applyTableQuery 側で Number() する
  value: z.string(),
});
export type TableFilter = z.infer<typeof TableFilterSchema>;

export const TableSortSchema = z.object({
  key: z.string(),
  direction: z.enum(['asc', 'desc']),
});
export type TableSort = z.infer<typeof TableSortSchema>;

// URL 上では `tf` (table filters) / `ts` (table sort) という短いキーで持つ
export const TableQuerySchema = z.object({
  tf: z.array(TableFilterSchema).optional(),
  ts: z.array(TableSortSchema).optional(),
});
export type TableQuery = z.infer<typeof TableQuerySchema>;

export function emptyTableQuery(): TableQuery {
  return {};
}

// 各列の「フィルタ可能性」と入力 UI のヒント
export type ColumnFilterKind = 'text' | 'number' | 'enum' | 'date';

export interface ColumnFilterSpec {
  // 比較用の値を行から取り出す。SortableColumn.accessor とは独立に上書き可
  // (例: 表示用 accessor が "日本語名::英名" を返すような列)
  getValue?: (row: unknown) => string | number | null | undefined;
  kind: ColumnFilterKind;
  // enum 用の選択肢
  enumOptions?: { value: string; label: string }[];
}

// 数値比較の op
const NUMERIC_OPS = new Set<TableFilterOp>(['gt', 'gte', 'lt', 'lte']);

// kind ごとに利用可能な op
export function opsForKind(kind: ColumnFilterKind): TableFilterOp[] {
  switch (kind) {
    case 'number':
      return ['eq', 'neq', 'gt', 'gte', 'lt', 'lte'];
    case 'enum':
      return ['eq', 'neq'];
    case 'date':
      return ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'contains'];
    case 'text':
      return ['contains', 'eq', 'neq'];
  }
}

// 1 件のフィルタを行に適用
function matchOne(raw: unknown, op: TableFilterOp, value: string, kind: ColumnFilterKind): boolean {
  if (raw == null) {
    // null は eq/neq 以外マッチさせない (gt 等で常に false)
    if (op === 'neq') return value !== '';
    if (op === 'eq') return value === '';
    return false;
  }
  if (kind === 'number' || NUMERIC_OPS.has(op)) {
    const a = Number(raw);
    const b = Number(value);
    if (Number.isNaN(a) || Number.isNaN(b)) return false;
    switch (op) {
      case 'eq':
        return a === b;
      case 'neq':
        return a !== b;
      case 'gt':
        return a > b;
      case 'gte':
        return a >= b;
      case 'lt':
        return a < b;
      case 'lte':
        return a <= b;
      default:
        return false;
    }
  }
  // text / enum / date(contains含む)
  const s = String(raw);
  switch (op) {
    case 'eq':
      return s === value;
    case 'neq':
      return s !== value;
    case 'contains':
      return s.toLowerCase().includes(value.toLowerCase());
    default:
      return false;
  }
}

export interface ColumnLike<T> {
  key: string;
  accessor?: (row: T) => string | number | null | undefined;
  numeric?: boolean;
  filter?: ColumnFilterSpec;
}

// query を行配列に適用してフィルタ済み + ソート済み配列を返す
export function applyTableQuery<T>(
  rows: readonly T[],
  columns: readonly ColumnLike<T>[],
  query: TableQuery,
): T[] {
  const { tf, ts } = query;

  // 1) フィルタ
  let out: T[] = rows as T[];
  if (tf && tf.length > 0) {
    const colByKey = new Map(columns.map((c) => [c.key, c]));
    out = out.filter((row) =>
      tf.every((f) => {
        const col = colByKey.get(f.field);
        if (!col) return true;
        const kind: ColumnFilterKind = col.filter?.kind ?? (col.numeric ? 'number' : 'text');
        const val = col.filter?.getValue
          ? col.filter.getValue(row as unknown)
          : col.accessor?.(row);
        return matchOne(val, f.op, f.value, kind);
      }),
    );
  }

  // 2) ソート (複数キー、配列の先頭ほど優先)
  if (ts && ts.length > 0) {
    const colByKey = new Map(columns.map((c) => [c.key, c]));
    const keyFns = ts.map((s) => {
      const col = colByKey.get(s.key);
      const acc =
        col?.accessor ??
        ((r: T) => (r as Record<string, unknown>)[s.key] as string | number | null | undefined);
      return { acc, numeric: col?.numeric ?? false, dir: s.direction === 'asc' ? 1 : -1 };
    });
    out = [...out].sort((a, b) => {
      for (const k of keyFns) {
        const va = k.acc(a);
        const vb = k.acc(b);
        if (va == null && vb == null) continue;
        if (va == null) return 1;
        if (vb == null) return -1;
        let cmp = 0;
        if (k.numeric) {
          const na = Number(va);
          const nb = Number(vb);
          cmp = na === nb ? 0 : na < nb ? -1 : 1;
        } else {
          const sa = String(va);
          const sb = String(vb);
          cmp = sa === sb ? 0 : sa < sb ? -1 : 1;
        }
        if (cmp !== 0) return cmp * k.dir;
      }
      return 0;
    });
  }

  return out;
}
