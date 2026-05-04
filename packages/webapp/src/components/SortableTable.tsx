// 汎用のソート可能テーブル
// columns で各列のキーとラベル・accessor を指定すると、列ヘッダクリックで昇順/降順を切替できる
// Shift + クリックで複数キーソート（クリック順に優先度が積み上がる）
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

export interface SortKey {
  key: string;
  direction: Direction;
}

export interface SortableTableProps<TRow> {
  columns: SortableColumn<TRow>[];
  rows: TRow[];
  rowKey: (row: TRow, index: number) => string;
  // 既定のソート（複数指定可、配列の先頭ほど優先）
  defaultSort?: SortKey | SortKey[];
  onRowClick?: (row: TRow) => void;
}

export function SortableTable<TRow>({
  columns,
  rows,
  rowKey,
  defaultSort,
  onRowClick,
}: SortableTableProps<TRow>) {
  const initial: SortKey[] = useMemo(() => {
    if (!defaultSort) return [];
    return Array.isArray(defaultSort) ? defaultSort : [defaultSort];
  }, [defaultSort]);
  const [sort, setSort] = useState<SortKey[]>(initial);

  function toggle(key: string, e: { shiftKey: boolean }) {
    const col = columns.find((c) => c.key === key);
    const defaultDir: Direction = col?.numeric ? 'desc' : 'asc';

    if (e.shiftKey) {
      // 複数キーソート: 既存末尾に追加、または同じキーなら方向反転 / 削除
      setSort((prev) => {
        const idx = prev.findIndex((s) => s.key === key);
        if (idx < 0) return [...prev, { key, direction: defaultDir }];
        const cur = prev[idx];
        // cur は idx で取得しているので必ず存在
        if (cur && cur.direction === defaultDir) {
          // 反対方向に切替
          const next = [...prev];
          next[idx] = { key, direction: defaultDir === 'asc' ? 'desc' : 'asc' };
          return next;
        }
        // 反対方向まで来たので削除（3 段階目で外す）
        return prev.filter((s) => s.key !== key);
      });
      return;
    }

    // 単一キーソート: 既に同じキーなら方向反転、別キーなら新規
    setSort((prev) => {
      if (prev.length === 1 && prev[0]?.key === key) {
        return [
          {
            key,
            direction: prev[0].direction === 'asc' ? 'desc' : 'asc',
          },
        ];
      }
      return [{ key, direction: defaultDir }];
    });
  }

  const sorted = useMemo(() => {
    if (sort.length === 0) return rows;
    // 各 sort key の比較関数を事前ビルド
    const keyFns = sort.map((s) => {
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
        // null/undefined は方向に関わらず常に末尾
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
  }, [rows, columns, sort]);

  // 各列の現在のソート優先度を Map にしておく
  const sortIndex = useMemo(() => {
    const m = new Map<string, { order: number; direction: Direction }>();
    sort.forEach((s, i) => m.set(s.key, { order: i + 1, direction: s.direction }));
    return m;
  }, [sort]);

  return (
    <Card withBorder p="xs" style={{ overflowX: 'auto' }}>
      <Table striped highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            {columns.map((c) => {
              const cur = sortIndex.get(c.key);
              return (
                <Table.Th key={c.key} style={{ textAlign: c.align ?? 'left' }}>
                  <UnstyledButton
                    onClick={(e) => toggle(c.key, { shiftKey: e.shiftKey })}
                    title="クリック: 単一ソート / Shift+クリック: 複数キーに追加"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                  >
                    <span>{c.label}</span>
                    <SortIcon current={cur} multi={sort.length > 1} />
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
  current,
  multi,
}: {
  current: { order: number; direction: Direction } | undefined;
  multi: boolean;
}) {
  if (!current) return <IconArrowsSort size={14} opacity={0.4} />;
  const Arrow = current.direction === 'asc' ? IconSortAscending : IconSortDescending;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
      <Arrow size={14} />
      {multi && (
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
          {current.order}
        </span>
      )}
    </span>
  );
}
