import { Badge, Loader, Stack, Text, Title } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearch } from '@tanstack/react-router';
import { FilterBar } from '../components/FilterBar';
import { QueryError } from '../components/QueryError';
import { SortableTable, type SortableColumn } from '../components/SortableTable';
import { useManifest } from '../hooks/useManifest';
import { query } from '../lib/duckdb/query';
import { buildWhereRuns } from '../lib/filter';
import { runsFrom } from '../queries/runsParquet';

interface RunRow {
  run_id: string;
  event_slug: string;
  device_slug: string;
  started_at: string | null;
  duration_sec: number | null;
  stage_count: number;
  outcome: string;
  final_hp: number | null;
  max_hp: number | null;
  final_deck_size: number | null;
}

const COLUMNS: SortableColumn<RunRow>[] = [
  {
    key: 'started_at',
    label: '開始時刻',
    accessor: (r) => r.started_at,
    render: (r) => (
      <Link
        // biome-ignore lint/suspicious/noExplicitAny: 動的 params の型推論が router 循環で効かない
        {...({ to: '/runs/$runId', params: { runId: r.run_id } } as any)}
        style={{ textDecoration: 'none' }}
      >
        {r.started_at ? new Date(r.started_at).toLocaleString('ja-JP') : '-'}
      </Link>
    ),
  },
  { key: 'device_slug', label: '機器', accessor: (r) => r.device_slug },
  {
    key: 'duration_sec',
    label: '長さ (秒)',
    accessor: (r) => r.duration_sec,
    render: (r) =>
      r.duration_sec != null ? Math.round(r.duration_sec).toLocaleString('ja-JP') : '-',
    numeric: true,
    align: 'right',
  },
  { key: 'stage_count', label: 'ステージ', accessor: (r) => r.stage_count, numeric: true, align: 'right' },
  {
    key: 'outcome',
    label: '勝敗',
    accessor: (r) => r.outcome,
    render: (r) => (
      <Badge color={outcomeColor(r.outcome)} variant="light">
        {r.outcome}
      </Badge>
    ),
  },
  {
    key: 'final_hp',
    label: 'HP',
    accessor: (r) => r.final_hp,
    render: (r) => `${r.final_hp ?? '-'} / ${r.max_hp ?? '-'}`,
    numeric: true,
    align: 'right',
  },
  {
    key: 'final_deck_size',
    label: 'デッキサイズ',
    accessor: (r) => r.final_deck_size,
    numeric: true,
    align: 'right',
  },
];

export function RunsListPage() {
  const search = useSearch({ from: '/runs' });
  const { data: manifest } = useManifest();
  const filterKey = JSON.stringify(search);

  const { data: rows, isLoading, error } = useQuery({
    queryKey: ['runs-list', filterKey, manifest?.generatedAt],
    enabled: !!manifest && manifest.datasets.length > 0,
    queryFn: async () => {
      if (!manifest) return [];
      const where = buildWhereRuns(search);
      const sql = `
        SELECT
          run_id, event_slug, device_slug, started_at, duration_sec,
          stage_count, outcome, final_hp, max_hp, final_deck_size
        FROM ${runsFrom(manifest.datasets)}
        ${where}
        ORDER BY started_at DESC
        LIMIT 500
      `;
      return await query<RunRow>(sql);
    },
  });

  return (
    <Stack>
      <Title order={2}>ラン一覧</Title>
      <FilterBar filter={search} navigateTo={{ to: '/runs' }} />
      <QueryError error={error} />
      <Text c="dimmed" size="sm">
        {rows?.length ?? 0} 件 (最大 500 件)
      </Text>
      {isLoading ? (
        <Loader />
      ) : (
        <SortableTable
          columns={COLUMNS}
          rows={rows ?? []}
          rowKey={(r) => r.run_id}
          defaultSort={{ key: 'started_at', direction: 'desc' }}
        />
      )}
    </Stack>
  );
}

function outcomeColor(outcome: string): string {
  switch (outcome) {
    case 'win':
      return 'green';
    case 'loss':
      return 'red';
    default:
      return 'gray';
  }
}
