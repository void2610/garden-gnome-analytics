import { Loader, Stack, Text, Title } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useManifest } from '../hooks/useManifest';
import { useLocalTableQuery } from '../hooks/useTableQuery';
import { query } from '../lib/duckdb/query';
import { type Filter, buildWhere } from '../lib/filter';
import { applyTableQuery } from '../lib/tableQuery';
import { eventsFrom } from '../queries/runsParquet';
import { QueryBar } from './QueryBar';
import { QueryError } from './QueryError';
import { SortableTable, type SortableColumn, type SortKey } from './SortableTable';

export interface EventAggregateTableProps<TRow> {
  title: string;
  description?: string;
  // 1 画面に複数の表を並べるので、react-query のキャッシュを表ごとに分ける
  queryKey: string;
  // events テーブルの FROM 句と、画面上部の絞り込みの WHERE 句から SQL を組み立てる
  buildSql: (eventsTable: string, where: string) => string;
  columns: SortableColumn<TRow>[];
  rowKey: (row: TRow) => string;
  defaultSort: SortKey[];
  filter: Filter;
}

// events を集計した結果を 1 つの表で出す。列の絞り込みと並べ替えは表ごとに持ち、URL には載せない
export function EventAggregateTable<TRow>({
  title,
  description,
  queryKey,
  buildSql,
  columns,
  rowKey,
  defaultSort,
  filter,
}: EventAggregateTableProps<TRow>) {
  const { data: manifest } = useManifest();
  const { query: tableQuery, setQuery: setTableQuery } = useLocalTableQuery();
  const filterKey = JSON.stringify({
    events: filter.events,
    devices: filter.devices,
    dateFrom: filter.dateFrom,
    dateTo: filter.dateTo,
  });

  const {
    data: rows,
    isLoading,
    error,
  } = useQuery({
    queryKey: [queryKey, filterKey, manifest?.generatedAt],
    enabled: !!manifest && manifest.datasets.length > 0,
    queryFn: async () => {
      if (!manifest) return [];
      return await query<TRow>(buildSql(eventsFrom(manifest.datasets), buildWhere(filter)));
    },
  });

  const visibleRows = useMemo(
    () => applyTableQuery(rows ?? [], columns, { tf: tableQuery.tf }),
    [rows, columns, tableQuery.tf],
  );

  return (
    <Stack gap="xs">
      <Title order={3}>{title}</Title>
      {description && (
        <Text c="dimmed" size="sm">
          {description}
        </Text>
      )}
      <QueryBar columns={columns} query={tableQuery} onChange={setTableQuery} />
      <QueryError error={error} />
      {isLoading ? (
        <Loader />
      ) : (
        <SortableTable
          columns={columns}
          rows={visibleRows}
          rowKey={rowKey}
          sort={tableQuery.ts}
          defaultSort={defaultSort}
          onSortChange={(s) => setTableQuery({ ...tableQuery, ts: s.length > 0 ? s : undefined })}
        />
      )}
      {rows && rows.length === 0 && <Text c="dimmed">該当なし</Text>}
    </Stack>
  );
}
