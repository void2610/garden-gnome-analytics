import type { SortableColumn } from '../components/SortableTable';

// 集計表の列の定義を短く書くための関数
export function textColumn<T>(
  key: keyof T & string,
  label: string,
  render?: (row: T) => string,
): SortableColumn<T> {
  return { key, label, accessor: (r) => r[key] as string, render, filter: { kind: 'text' } };
}

export function numberColumn<T>(key: keyof T & string, label: string): SortableColumn<T> {
  return {
    key,
    label,
    accessor: (r) => r[key] as number,
    numeric: true,
    align: 'right',
    filter: { kind: 'number' },
  };
}

// 割合 (0〜1) を百分率で出す。分母が 0 のときは null
export function rateColumn<T>(key: keyof T & string, label: string): SortableColumn<T> {
  return {
    key,
    label,
    accessor: (r) => r[key] as number | null,
    render: (r) => {
      const v = r[key] as number | null;
      return v == null ? '-' : `${(v * 100).toFixed(1)}%`;
    },
    numeric: true,
    align: 'right',
    filter: { kind: 'number' },
  };
}
