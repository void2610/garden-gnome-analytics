// 汎用のソート可能テーブル
// 列ヘッダをクリックすると「未指定 → デフォルト方向 → 反対方向 → 削除」の 3 段階で
// ソートキーを切り替える。複数キーは「クリックした順」で優先度が積み上がる。
//
// 使い方は 2 系統:
//  1) 非制御モード (defaultSort 渡し): 内部 state でソートを保持。テスト互換のため維持。
//  2) 制御モード (onSortChange 渡し): 親 (URL search 等) からソート状態を渡す。
//     `sort` は「ユーザが明示的に指定した」ソートのみを表す (空 / undefined なら未指定)。
//     `defaultSort` は明示指定が無い間の表示・適用フォールバックとして使われ、
//     ユーザが新しい列をクリックして明示ソートを始めると入れ替わる (積み上がらない)。
import { ActionIcon, Card, Group, Table, Text, UnstyledButton } from '@mantine/core';
import { IconArrowsSort, IconSortAscending, IconSortDescending, IconX } from '@tabler/icons-react';
import { type ReactNode, useMemo, useState } from 'react';
import type { ColumnFilterSpec } from '../lib/tableQuery';

export interface SortableColumn<TRow> {
  key: string;
  label: string;
  accessor?: (row: TRow) => string | number | null | undefined;
  render?: (row: TRow) => ReactNode;
  align?: 'left' | 'right' | 'center';
  // 数値ソートしたい列は true（accessor の結果が文字列でも Number() で比較）
  numeric?: boolean;
  // QueryBar 側でフィルタ対象にする場合のヒント
  filter?: ColumnFilterSpec;
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
  // 制御モード: sort と onSortChange を両方渡すと内部 state を使わない
  sort?: SortKey[];
  onSortChange?: (next: SortKey[]) => void;
  onRowClick?: (row: TRow) => void;
}

export function SortableTable<TRow>({
  columns,
  rows,
  rowKey,
  defaultSort,
  sort: controlledSort,
  onSortChange,
  onRowClick,
}: SortableTableProps<TRow>) {
  const initial: SortKey[] = useMemo(() => {
    if (!defaultSort) return [];
    return Array.isArray(defaultSort) ? defaultSort : [defaultSort];
  }, [defaultSort]);
  const [internalSort, setInternalSort] = useState<SortKey[]>(initial);

  // 制御モード判定: onSortChange が渡されたら制御モード (sort は undefined / 空でも OK)。
  const isControlled = onSortChange !== undefined;
  // 「ユーザが明示的に指定したソート」。制御モードでは親から渡される値、
  // 非制御モードでは内部 state を使う。
  const explicitSort = isControlled ? (controlledSort ?? []) : internalSort;
  // 実際にデータ並び替えとヘッダ表示に使うソート。明示指定が空なら defaultSort で埋める。
  const effectiveSort = explicitSort.length > 0 ? explicitSort : initial;

  function setSort(next: SortKey[]) {
    if (isControlled) {
      onSortChange(next);
    } else {
      setInternalSort(next);
    }
  }

  function toggle(key: string) {
    const col = columns.find((c) => c.key === key);
    const defaultDir: Direction = col?.numeric ? 'desc' : 'asc';

    // cycle は「明示指定」のみを対象にする。デフォルトソートは巻き込まない。
    const idx = explicitSort.findIndex((s) => s.key === key);
    if (idx < 0) {
      // 未指定 → 末尾に追加（デフォルト方向）。明示指定が空ならこの一件だけになる。
      setSort([...explicitSort, { key, direction: defaultDir }]);
      return;
    }
    const cur = explicitSort[idx];
    if (!cur) return;
    if (cur.direction === defaultDir) {
      // デフォルト方向 → 反対方向に反転（優先度はそのまま）
      const next = [...explicitSort];
      next[idx] = { key, direction: defaultDir === 'asc' ? 'desc' : 'asc' };
      setSort(next);
      return;
    }
    // 反対方向まで進んでいる → 削除
    setSort(explicitSort.filter((s) => s.key !== key));
  }

  function resetSort() {
    setSort([]);
  }

  const sorted = useMemo(() => {
    if (effectiveSort.length === 0) return rows;
    const keyFns = effectiveSort.map((s) => {
      const col = columns.find((c) => c.key === s.key);
      const acc =
        col?.accessor ??
        ((r: TRow) => (r as Record<string, unknown>)[s.key] as string | number | null | undefined);
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
  }, [rows, columns, effectiveSort]);

  const sortIndex = useMemo(() => {
    const m = new Map<string, { order: number; direction: Direction }>();
    effectiveSort.forEach((s, i) => m.set(s.key, { order: i + 1, direction: s.direction }));
    return m;
  }, [effectiveSort]);

  // 現在のソート状態を文字で表示するためのラベル (非制御モード時のみ)
  const sortSummary = useMemo(() => {
    return effectiveSort
      .map((s) => {
        const col = columns.find((c) => c.key === s.key);
        const arrow = s.direction === 'asc' ? '↑' : '↓';
        return `${col?.label ?? s.key} ${arrow}`;
      })
      .join('  →  ');
  }, [effectiveSort, columns]);

  // 制御モード時は親 (QueryBar) がソート表示を担当するので、テーブル内のサマリは出さない
  const showSummary = !isControlled && effectiveSort.length > 0;

  return (
    <Card withBorder p="xs" style={{ overflowX: 'auto' }}>
      {showSummary && (
        <Group gap="xs" mb="xs" align="center">
          <Text size="xs" c="dimmed">
            ソート: {sortSummary}
          </Text>
          <ActionIcon
            size="xs"
            variant="subtle"
            color="gray"
            aria-label="ソートをリセット"
            onClick={resetSort}
          >
            <IconX size={12} />
          </ActionIcon>
        </Group>
      )}
      <Table striped highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            {columns.map((c) => {
              const cur = sortIndex.get(c.key);
              return (
                <Table.Th key={c.key} style={{ textAlign: c.align ?? 'left' }}>
                  <UnstyledButton
                    onClick={() => toggle(c.key)}
                    title="クリックでソートを追加 / 反転 / 削除"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                  >
                    <span>{c.label}</span>
                    <SortIcon current={cur} multi={effectiveSort.length > 1} />
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
