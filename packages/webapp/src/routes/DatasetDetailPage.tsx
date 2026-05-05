// 機器 (event_slug + device_slug) 単位のデータセット詳細ページ。
// 概要カードに加えて、この機器に紐付くラン一覧をテーブル表示し、特定 run を選択できるようにする。
import { Badge, Card, Group, Loader, SimpleGrid, Stack, Text, Title } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from '@tanstack/react-router';
import { useMemo } from 'react';
import { QueryBar } from '../components/QueryBar';
import { type SortableColumn, type SortKey, SortableTable } from '../components/SortableTable';
import { useManifest } from '../hooks/useManifest';
import { useLocalTableQuery } from '../hooks/useTableQuery';
import { eventsParquetUrl, runsParquetUrl } from '../lib/duckdb/paths';
import { query } from '../lib/duckdb/query';
import { applyTableQuery } from '../lib/tableQuery';

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

const RUN_COLUMNS: SortableColumn<RunRow>[] = [
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
];

const DEFAULT_SORT: SortKey[] = [{ key: 'started_at', direction: 'desc' }];

export function DatasetDetailPage() {
  const params = useParams({ from: '/datasets/$slug' });
  const slug = params.slug;
  const { data: manifest } = useManifest();
  const dataset = manifest?.datasets.find((d) => `${d.eventSlug}__${d.deviceSlug}` === slug);
  const { query: tableQuery, setQuery: setTableQuery } = useLocalTableQuery();

  const { data: counts, isLoading: countsLoading } = useQuery({
    queryKey: ['dataset-count', slug],
    enabled: !!dataset,
    queryFn: async () => {
      if (!dataset) return null;
      const eUrl = eventsParquetUrl(dataset.eventSlug, dataset.deviceSlug);
      const rUrl = runsParquetUrl(dataset.eventSlug, dataset.deviceSlug);
      const [eventCount] = await query<{ c: number }>(
        `SELECT COUNT(*)::INTEGER c FROM read_parquet('${eUrl}')`,
      );
      const [runCount] = await query<{ c: number }>(
        `SELECT COUNT(*)::INTEGER c FROM read_parquet('${rUrl}')`,
      );
      return { events: eventCount?.c ?? 0, runs: runCount?.c ?? 0 };
    },
  });

  const { data: runs, isLoading: runsLoading } = useQuery({
    queryKey: ['dataset-runs', slug],
    enabled: !!dataset,
    queryFn: async () => {
      if (!dataset) return [];
      const rUrl = runsParquetUrl(dataset.eventSlug, dataset.deviceSlug);
      return await query<RunRow>(`
        SELECT
          run_id, event_slug, device_slug, started_at, duration_sec,
          stage_count, outcome, final_hp, max_hp, final_deck_size
        FROM read_parquet('${rUrl}')
        ORDER BY started_at DESC
      `);
    },
  });

  const visibleRuns = useMemo(
    () => applyTableQuery(runs ?? [], RUN_COLUMNS, { tf: tableQuery.tf }),
    [runs, tableQuery.tf],
  );

  if (!dataset) return <Text>データセット {slug} は manifest に存在しません</Text>;

  return (
    <Stack>
      <Group gap="xs">
        <Link
          // biome-ignore lint/suspicious/noExplicitAny: 動的 params の型推論が router 循環で効かない
          {...({ to: '/events/$eventSlug', params: { eventSlug: dataset.eventSlug } } as any)}
          style={{ textDecoration: 'none', color: 'inherit' }}
        >
          <Text size="sm" c="dimmed">
            ← {dataset.meta.event}
          </Text>
        </Link>
      </Group>
      <Title order={2}>
        {dataset.meta.event} / {dataset.meta.device}
      </Title>
      <Text c="dimmed">
        {dataset.meta.game_version ?? '-'} / {dataset.meta.venue ?? ''}
      </Text>
      {dataset.meta.notes && <Text size="sm">{dataset.meta.notes}</Text>}

      <SimpleGrid cols={{ base: 1, sm: 3 }} mt="md">
        <Card withBorder padding="md">
          <Text size="sm" c="dimmed">
            ラン数
          </Text>
          {countsLoading ? <Loader size="sm" /> : <Title order={3}>{counts?.runs}</Title>}
        </Card>
        <Card withBorder padding="md">
          <Text size="sm" c="dimmed">
            イベント数
          </Text>
          {countsLoading ? <Loader size="sm" /> : <Title order={3}>{counts?.events}</Title>}
        </Card>
        <Card withBorder padding="md">
          <Text size="sm" c="dimmed">
            エラー数
          </Text>
          <Title order={3}>{dataset.errorCount}</Title>
        </Card>
      </SimpleGrid>

      <Card withBorder padding="md">
        <Text size="sm" c="dimmed">
          期間
        </Text>
        <Text>
          {dataset.period.from ? new Date(dataset.period.from).toLocaleString('ja-JP') : '-'}
          <br />
          {dataset.period.to ? new Date(dataset.period.to).toLocaleString('ja-JP') : '-'}
        </Text>
      </Card>

      <Title order={3} mt="md">
        ラン一覧 ({visibleRuns.length} / {runs?.length ?? 0} 件)
      </Title>
      <QueryBar columns={RUN_COLUMNS} query={tableQuery} onChange={setTableQuery} />
      {runsLoading ? (
        <Loader />
      ) : (
        <SortableTable
          columns={RUN_COLUMNS}
          rows={visibleRuns}
          rowKey={(r) => `${r.event_slug}__${r.device_slug}__${r.run_id}`}
          sort={tableQuery.ts ?? DEFAULT_SORT}
          onSortChange={(s) => setTableQuery({ ...tableQuery, ts: s })}
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
