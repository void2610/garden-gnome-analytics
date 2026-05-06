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
import { buildWhereRuns } from '../lib/filter';
import { applyTableQuery } from '../lib/tableQuery';
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

const OUTCOME_OPTIONS = [
  { value: 'win', label: 'win' },
  { value: 'loss', label: 'loss' },
  { value: 'abandoned', label: 'abandoned' },
];

const DEFAULT_SORT: SortKey[] = [{ key: 'started_at', direction: 'desc' }];

export function RunsListPage() {
  const search = useSearch({ from: '/runs' });
  const { data: manifest } = useManifest();
  const { query: tableQuery, setQuery: setTableQuery } = useUrlTableQuery({
    to: '/runs',
    search,
  });
  // 機器列の enum 選択肢は manifest から動的に作る
  const deviceOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const d of manifest?.datasets ?? []) {
      if (!seen.has(d.deviceSlug)) seen.set(d.deviceSlug, d.meta.device);
    }
    return [...seen.entries()].map(([value, label]) => ({ value, label }));
  }, [manifest]);

  const columns: SortableColumn<RunRow>[] = useMemo(
    () => [
      {
        key: 'started_at',
        label: '開始時刻',
        accessor: (r) => r.started_at,
        filter: { kind: 'date' },
        render: (r) => {
          const slug = `${r.event_slug}__${r.device_slug}__${r.run_id}`;
          return (
            <Link
              // biome-ignore lint/suspicious/noExplicitAny: 動的 params の型推論が router 循環で効かない
              {...({ to: '/runs/$slug', params: { slug } } as any)}
              style={{ textDecoration: 'none', color: 'inherit' }}
            >
              {r.started_at ? new Date(r.started_at).toLocaleString('ja-JP') : '-'}
            </Link>
          );
        },
      },
      {
        key: 'device_slug',
        label: '機器',
        accessor: (r) => r.device_slug,
        filter: { kind: 'enum', enumOptions: deviceOptions },
      },
      {
        key: 'duration_sec',
        label: '長さ (秒)',
        accessor: (r) => r.duration_sec,
        render: (r) =>
          r.duration_sec != null ? Math.round(r.duration_sec).toLocaleString('ja-JP') : '-',
        numeric: true,
        align: 'right',
        filter: { kind: 'number' },
      },
      {
        key: 'stage_count',
        label: 'ステージ',
        accessor: (r) => r.stage_count,
        numeric: true,
        align: 'right',
        filter: { kind: 'number' },
      },
      {
        key: 'outcome',
        label: '勝敗',
        accessor: (r) => r.outcome,
        render: (r) => (
          <Badge color={outcomeColor(r.outcome)} variant="light">
            {r.outcome}
          </Badge>
        ),
        filter: { kind: 'enum', enumOptions: OUTCOME_OPTIONS },
      },
      {
        key: 'final_hp',
        label: 'HP',
        accessor: (r) => r.final_hp,
        render: (r) => `${r.final_hp ?? '-'} / ${r.max_hp ?? '-'}`,
        numeric: true,
        align: 'right',
        filter: { kind: 'number' },
      },
      {
        key: 'final_deck_size',
        label: 'デッキサイズ',
        accessor: (r) => r.final_deck_size,
        numeric: true,
        align: 'right',
        filter: { kind: 'number' },
      },
    ],
    [deviceOptions],
  );

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
    queryKey: ['runs-list', filterKey, manifest?.generatedAt],
    enabled: !!manifest && manifest.datasets.length > 0,
    queryFn: async () => {
      if (!manifest) return [];
      const where = buildWhereRuns({
        events: search.events,
        devices: search.devices,
        dateFrom: search.dateFrom,
        dateTo: search.dateTo,
      });
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

  // tableQuery (列フィルタ + 多段ソート) はクライアントサイドで適用
  const visibleRows = useMemo(
    () => applyTableQuery(rows ?? [], columns, { tf: tableQuery.tf }),
    [rows, columns, tableQuery.tf],
  );

  return (
    <Stack>
      <Title order={2}>ラン一覧</Title>
      <FilterBar filter={search} navigateTo={{ to: '/runs' }} />
      <QueryBar columns={columns} query={tableQuery} onChange={setTableQuery} />
      <QueryError error={error} />
      <Text c="dimmed" size="sm">
        {visibleRows.length} 件 (取得 {rows?.length ?? 0} 件 / 最大 500 件)
      </Text>
      {isLoading ? (
        <Loader />
      ) : (
        <SortableTable
          columns={columns}
          rows={visibleRows}
          rowKey={(r) => `${r.event_slug}__${r.device_slug}__${r.run_id}`}
          sort={tableQuery.ts}
          defaultSort={DEFAULT_SORT}
          onSortChange={(s) =>
            setTableQuery({ ...tableQuery, ts: s.length > 0 ? s : undefined })
          }
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
