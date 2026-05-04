import { Badge, Loader, Stack, Text, Title } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearch } from '@tanstack/react-router';
import { FilterBar } from '../components/FilterBar';
import { QueryError } from '../components/QueryError';
import { SortableTable, type SortableColumn } from '../components/SortableTable';
import { useManifest } from '../hooks/useManifest';
import { query } from '../lib/duckdb/query';
import { buildWhere } from '../lib/filter';
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

const COLUMNS: SortableColumn<ErrorRow>[] = [
  {
    key: 'level',
    label: 'level',
    accessor: (r) => r.level,
    render: (r) => (
      <Badge color={r.level === 'Exception' ? 'red' : 'orange'}>{r.level}</Badge>
    ),
  },
  { key: 'count', label: '件数', accessor: (r) => r.count, numeric: true, align: 'right' },
  {
    key: 'message',
    label: 'メッセージ',
    accessor: (r) => r.message,
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

export function ErrorsPage() {
  const search = useSearch({ from: '/errors' });
  const { data: manifest } = useManifest();
  const filterKey = JSON.stringify(search);

  const { data: rows, isLoading, error } = useQuery({
    queryKey: ['errors-list', filterKey, manifest?.generatedAt],
    enabled: !!manifest && manifest.datasets.length > 0,
    queryFn: async () => {
      if (!manifest) return [];
      const where = buildWhere(search);
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

  return (
    <Stack>
      <Title order={2}>エラー一覧</Title>
      <FilterBar filter={search} navigateTo={{ to: '/errors' }} />
      <QueryError error={error} />
      {isLoading ? (
        <Loader />
      ) : (
        <SortableTable
          columns={COLUMNS}
          rows={rows ?? []}
          rowKey={(r, i) => `${r.level}-${i}`}
          defaultSort={{ key: 'count', direction: 'desc' }}
        />
      )}
      {rows && rows.length === 0 && <Text c="dimmed">エラーなし</Text>}
    </Stack>
  );
}
