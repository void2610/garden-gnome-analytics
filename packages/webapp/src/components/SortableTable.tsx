// 汎用のソート可能テーブル
// 各列を独立にトグル: クリックで none → 昇順 → 降順 → none を循環
// 複数列が同時に有効なときは、列の左→右の順を優先度として並び替える
import { Card, Table, UnstyledButton } from '@mantine/core';
import { IconArrowsSort, IconSortAscending, IconSortDescending } from '@tabler/icons-react';
import { useMemo, useState, type ReactNode } from 'react';

export interface SortableColumn<TRow> {
  key: string;
  label: string;
  accessor?: (row: TRow) => string | number | null | undefined;
  render?: (row: TRow) => ReactNode;
  align?: 'left' | 'right' | 'center';
  // 数値ソートしたい列は true（accessor の結果が文字列でも Number() で比較）
  numeric?: boolean;
}

type Direction = 'asc' | 'desc';
type DirState = Direction | null;

export interface SortableTableProps<TRow> {
  columns: SortableColumn<TRow>[];
  rows: TRow[];
  rowKey: (row: TRow, index: number) => string;
  // 初期ソート: 列キー → 方向 のマップ
  defaultSort?: Record<string, Direction>;
  onRowClick?: (row: TRow) => void;
}

export function SortableTable<TRow>({
  columns,
  rows,
  rowKey,
  defaultSort,
  onRowClick,
}: SortableTableProps<TRow>) {
  const [dirs, setDirs] = useState<Record<string, DirState>>(() => ({
    ...(defaultSort ?? {}),
  }));

  function toggle(key: string) {
    const col = columns.find((c) => c.key === key);
    const initial: Direction = col?.numeric ? 'desc' : 'asc';
    setDirs((prev) => {
      const cur = prev[key] ?? null;
      // none → 初期方向 → 反対方向 → none を循環
      let next: DirState;
      if (cur === null) next = initial;
      else if (cur === initial) next = initial === 'asc' ? 'desc' : 'asc';
      else next = null;
      // 値が null になるならキーごと消す
      const out = { ...prev };
      if (next === null) delete out[key];
      else out[key] = next;
      return out;
    });
  }

  // 列の左→右順を優先度として、有効な並び替え列リストを作る
  const activeSortKeys = useMemo(() => {
    return columns
      .map((c) => ({ key: c.key, direction: dirs[c.key] ?? null }))
      .filter((s): s is { key: string; direction: Direction } => s.direction !== null);
  }, [columns, dirs]);

  const sorted = useMemo(() => {
    if (activeSortKeys.length === 0) return rows;
    const keyFns = activeSortKeys.map((s) => {
      const col = columns.find((c) => c.key === s.key);
      const acc =
        col?.accessor ??
        ((r: TRow) =>
          (r as Record<string, unknown>)[s.key] as string | number | null | undefined);
      return {
        acc,
        numeric: col?.numeric ?? false,
        dir: s.direction === 'asc' ? 1 : -1,
      };
    });
    return [...rows].sort((a, b) => {
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
  }, [rows, columns, activeSortKeys]);

  // 各列の現在の優先度（複数キーが有効な時のみバッジ表示）
  const priorityByKey = useMemo(() => {
    const m = new Map<string, number>();
    activeSortKeys.forEach((s, i) => m.set(s.key, i + 1));
    return m;
  }, [activeSortKeys]);

  return (
    <Card withBorder p="xs" style={{ overflowX: 'auto' }}>
      <Table striped highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            {columns.map((c) => {
              const direction = dirs[c.key] ?? null;
              const priority = priorityByKey.get(c.key);
              return (
                <Table.Th key={c.key} style={{ textAlign: c.align ?? 'left' }}>
                  <UnstyledButton
                    onClick={() => toggle(c.key)}
                    title="クリックでソート切替 (none → 昇順 → 降順 → none)"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                  >
                    <span>{c.label}</span>
                    <SortIcon
                      direction={direction}
                      priority={priority}
                      showPriority={activeSortKeys.length > 1}
                    />
                  </UnstyledButton>
                </Table.Th>
              );
            })}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {sorted.map((row, i) => (
            <Table.Tr
              key={rowKey(row, i)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              style={onRowClick ? { cursor: 'pointer' } : undefined}
            >
              {columns.map((c) => {
                const content =
                  c.render?.(row) ??
                  (c.accessor
                    ? c.accessor(row)
                    : ((row as Record<string, unknown>)[c.key] as ReactNode)) ??
                  '-';
                return (
                  <Table.Td key={c.key} style={{ textAlign: c.align ?? 'left' }}>
                    {content as ReactNode}
                  </Table.Td>
                );
              })}
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Card>
  );
}

function SortIcon({
  direction,
  priority,
  showPriority,
}: {
  direction: DirState;
  priority: number | undefined;
  showPriority: boolean;
}) {
  if (!direction) return <IconArrowsSort size={14} opacity={0.4} />;
  const Arrow = direction === 'asc' ? IconSortAscending : IconSortDescending;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
      <Arrow size={14} />
      {showPriority && priority != null && (
        <span
          style={{
            fontSize: 10,
            opacity: 0.7,
            background: 'var(--mantine-color-gray-light)',
            borderRadius: 8,
            padding: '0 4px',
            lineHeight: 1.4,
          }}
        >
          {priority}
        </span>
      )}
    </span>
  );
}
