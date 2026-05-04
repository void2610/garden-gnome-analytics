// 汎用のソート可能テーブル
// columns で各列のキーとラベル・accessor を指定すると、列ヘッダクリックで昇順/降順を切替できる
import { Card, Group, Table, UnstyledButton } from '@mantine/core';
import { IconArrowsSort, IconSortAscending, IconSortDescending } from '@tabler/icons-react';
import { useMemo, useState, type ReactNode } from 'react';

export interface SortableColumn<TRow> {
  key: string;
  label: string;
  // 行から比較用の値を取り出す（未指定時は row[key]）
  accessor?: (row: TRow) => string | number | null | undefined;
  // 表示は別関数で（未指定なら accessor 結果をそのまま）
  render?: (row: TRow) => ReactNode;
  align?: 'left' | 'right' | 'center';
  // 既定で「数値ソート」したい場合 true（accessor が string でも数値化）
  numeric?: boolean;
}

export interface SortableTableProps<TRow> {
  columns: SortableColumn<TRow>[];
  rows: TRow[];
  // 行のキー
  rowKey: (row: TRow, index: number) => string;
  defaultSort?: { key: string; direction: 'asc' | 'desc' };
  // 行クリック
  onRowClick?: (row: TRow) => void;
}

type Direction = 'asc' | 'desc';

export function SortableTable<TRow>({
  columns,
  rows,
  rowKey,
  defaultSort,
  onRowClick,
}: SortableTableProps<TRow>) {
  const [sortKey, setSortKey] = useState<string | null>(defaultSort?.key ?? null);
  const [direction, setDirection] = useState<Direction>(defaultSort?.direction ?? 'desc');

  function toggle(key: string) {
    if (sortKey === key) {
      setDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      // 文字列列はデフォルト昇順、数値列はデフォルト降順
      const col = columns.find((c) => c.key === key);
      setDirection(col?.numeric ? 'desc' : 'asc');
    }
  }

  const sorted = useMemo(() => {
    if (!sortKey) return rows;
    const col = columns.find((c) => c.key === sortKey);
    if (!col) return rows;
    const acc = col.accessor ?? ((r: TRow) => (r as Record<string, unknown>)[sortKey] as string | number | null | undefined);
    const numeric = col.numeric ?? false;
    const dir = direction === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const va = acc(a);
      const vb = acc(b);
      // null/undefined は常に末尾
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      if (numeric) {
        const na = Number(va);
        const nb = Number(vb);
        return na === nb ? 0 : (na < nb ? -1 : 1) * dir;
      }
      const sa = String(va);
      const sb = String(vb);
      return sa === sb ? 0 : (sa < sb ? -1 : 1) * dir;
    });
  }, [rows, columns, sortKey, direction]);

  return (
    <Card withBorder p="xs" style={{ overflowX: 'auto' }}>
      <Table striped highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            {columns.map((c) => (
              <Table.Th key={c.key} style={{ textAlign: c.align ?? 'left' }}>
                <UnstyledButton
                  onClick={() => toggle(c.key)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                >
                  <span>{c.label}</span>
                  <SortIcon active={sortKey === c.key} direction={direction} />
                </UnstyledButton>
              </Table.Th>
            ))}
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
                const content = c.render
                  ? c.render(row)
                  : (c.accessor
                      ? c.accessor(row)
                      : ((row as Record<string, unknown>)[c.key] as ReactNode)) ?? '-';
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

function SortIcon({ active, direction }: { active: boolean; direction: Direction }) {
  if (!active) return <IconArrowsSort size={14} opacity={0.4} />;
  return direction === 'asc' ? (
    <IconSortAscending size={14} />
  ) : (
    <IconSortDescending size={14} />
  );
}

// 補助: ヘッダの右寄せ用ラッパ（数値列でラベル右寄せ＋アイコン左寄せにしたい時用）
export function HeaderInline({ children }: { children: ReactNode }) {
  return (
    <Group gap={4} wrap="nowrap">
      {children}
    </Group>
  );
}
