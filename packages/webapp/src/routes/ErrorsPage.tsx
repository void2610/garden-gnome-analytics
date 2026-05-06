import { Badge, Loader, Stack, Text, Title } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearch } from '@tanstack/react-router';
import { useMemo } from 'react';
import { FilterBar } from '../components/FilterBar';
import { QueryBar } from '../components/QueryBar';
import { QueryError } from '../components/QueryError';
import { SortableTable, type SortableColumn, type SortKey } from '../components/SortableTable';
import { useManifest } from '../hooks/useManifest';
import { useUrlTableQuery } from '../hooks/useTableQuery';
import { query } from '../lib/duckdb/query';
import { buildWhere } from '../lib/filter';
import { applyTableQuery } from '../lib/tableQuery';
import { errorsFrom } from '../queries/runsParquet';

interface ErrorRow {
  timestamp: string;
  level: string;
  message: string;
  run_id: string | null;
  event_slug: string | null;
  device_slug: string | null;
  count: number;
}

const LEVEL_OPTIONS = [
  { value: 'Error', label: 'Error' },
  { value: 'Exception', label: 'Exception' },
];

const COLUMNS: SortableColumn<ErrorRow>[] = [
  {
    key: 'level',
    label: 'level',
    accessor: (r) => r.level,
    render: (r) => <Badge color={r.level === 'Exception' ? 'red' : 'orange'}>{r.level}</Badge>,
    filter: { kind: 'enum', enumOptions: LEVEL_OPTIONS },
  },
  {
    key: 'count',
    label: '件数',
    accessor: (r) => r.count,
    numeric: true,
    align: 'right',
    filter: { kind: 'number' },
  },
  {
    key: 'message',
    label: 'メッセージ',
    accessor: (r) => r.message,
    filter: { kind: 'text' },
    render: (r) => (
      <span
        style={{
          display: 'inline-block',
          maxWidth: 480,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          verticalAlign: 'bottom',
        }}
        title={r.message}
      >
        {r.message}
      </span>
    ),
  },
  {
    key: 'run_id',
    label: '例: 関連 run',
    accessor: (r) => r.run_id ?? '',
    filter: { kind: 'text' },
    render: (r) =>
      r.run_id && r.event_slug && r.device_slug ? (
        <Link
          {...({
            to: '/runs/$slug',
            params: { slug: `${r.event_slug}__${r.device_slug}__${r.run_id}` },
            // biome-ignore lint/suspicious/noExplicitAny: 動的 params の型推論が router 循環で効かない
          } as any)}
        >
          {r.run_id}
        </Link>
      ) : (
        <Text c="dimmed">-</Text>
      ),
  },
];

const DEFAULT_SORT: SortKey[] = [{ key: 'count', direction: 'desc' }];

export function ErrorsPage() {
  const search = useSearch({ from: '/errors' });
  const { data: manifest } = useManifest();
  const { query: tableQuery, setQuery: setTableQuery } = useUrlTableQuery({
    to: '/errors',
    search,
  });

  const filterKey = JSON.stringify({
    events: search.events,
    devices: search.devices,
    dateFrom: search.dateFrom,
    dateTo: search.dateTo,
  });

  const {
    data: rows,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['errors-list', filterKey, manifest?.generatedAt],
    enabled: !!manifest && manifest.datasets.length > 0,
    queryFn: async () => {
      if (!manifest) return [];
      const where = buildWhere({
        events: search.events,
        devices: search.devices,
        dateFrom: search.dateFrom,
        dateTo: search.dateTo,
      });
      const sql = `
        SELECT
          ANY_VALUE(timestamp) AS timestamp,
          level,
          message,
          ANY_VALUE(run_id) AS run_id,
          ANY_VALUE(event_slug) AS event_slug,
          ANY_VALUE(device_slug) AS device_slug,
          COUNT(*)::INTEGER AS count
        FROM ${errorsFrom(manifest.datasets)}
        ${where}
        GROUP BY level, message
        ORDER BY count DESC
        LIMIT 200
      `;
      return await query<ErrorRow>(sql);
    },
  });

  const visibleRows = useMemo(
    () => applyTableQuery(rows ?? [], COLUMNS, { tf: tableQuery.tf }),
    [rows, tableQuery.tf],
  );

  return (
    <Stack>
      <Title order={2}>エラー一覧</Title>
      <FilterBar filter={search} navigateTo={{ to: '/errors' }} />
      <QueryBar columns={COLUMNS} query={tableQuery} onChange={setTableQuery} />
      <QueryError error={error} />
      <Text c="dimmed" size="sm">
        {visibleRows.length} 件 (取得 {rows?.length ?? 0} 件 / 最大 200 件)
      </Text>
      {isLoading ? (
        <Loader />
      ) : (
        <SortableTable
          columns={COLUMNS}
          rows={visibleRows}
          rowKey={(r, i) => `${r.level}-${i}`}
          sort={tableQuery.ts}
          defaultSort={DEFAULT_SORT}
          onSortChange={(s) =>
            setTableQuery({ ...tableQuery, ts: s.length > 0 ? s : undefined })
          }
        />
      )}
      {rows && rows.length === 0 && <Text c="dimmed">エラーなし</Text>}
    </Stack>
  );
}
