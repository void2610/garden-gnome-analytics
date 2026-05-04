import { Loader, Stack, Text, Title } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { useSearch } from '@tanstack/react-router';
import { FilterBar } from '../components/FilterBar';
import { QueryError } from '../components/QueryError';
import { SortableTable, type SortableColumn } from '../components/SortableTable';
import { useManifest } from '../hooks/useManifest';
import { query } from '../lib/duckdb/query';
import { buildWhere } from '../lib/filter';
import { eventsFrom } from '../queries/runsParquet';

interface StageStat {
  stage_id: string;
  reach_count: number;
  win_count: number;
  loss_count: number;
  avg_turns: number | null;
}

const COLUMNS: SortableColumn<StageStat>[] = [
  { key: 'stage_id', label: 'stageId', accessor: (r) => r.stage_id },
  { key: 'reach_count', label: '到達数', accessor: (r) => r.reach_count, numeric: true, align: 'right' },
  { key: 'win_count', label: '勝利数', accessor: (r) => r.win_count, numeric: true, align: 'right' },
  { key: 'loss_count', label: '敗北数', accessor: (r) => r.loss_count, numeric: true, align: 'right' },
  {
    key: 'avg_turns',
    label: '平均ターン数',
    accessor: (r) => r.avg_turns,
    render: (r) => (r.avg_turns != null ? r.avg_turns.toFixed(1) : '-'),
    numeric: true,
    align: 'right',
  },
  {
    key: 'win_rate',
    label: '勝率',
    accessor: (r) => {
      const total = r.win_count + r.loss_count;
      return total > 0 ? r.win_count / total : null;
    },
    render: (r) => {
      const total = r.win_count + r.loss_count;
      return total > 0 ? `${((r.win_count / total) * 100).toFixed(1)}%` : '-';
    },
    numeric: true,
    align: 'right',
  },
];

export function StagesPage() {
  const search = useSearch({ from: '/stages' });
  const { data: manifest } = useManifest();
  const filterKey = JSON.stringify(search);

  const { data: rows, isLoading, error } = useQuery({
    queryKey: ['stages-stats', filterKey, manifest?.generatedAt],
    enabled: !!manifest && manifest.datasets.length > 0,
    queryFn: async () => {
      if (!manifest) return [];
      const where = buildWhere(search);
      const sql = `
        WITH stage_events AS (
          SELECT
            run_id,
            seq,
            event_type,
            json_extract_string(payload, '$.stageId') AS stage_id,
            json_extract(payload, '$.turnCount') AS turn_count
          FROM ${eventsFrom(manifest.datasets)}
          ${where}
        )
        SELECT
          stage_id,
          SUM(CASE WHEN event_type IN ('StageEnter','BattleStart') THEN 1 ELSE 0 END)::INTEGER AS reach_count,
          SUM(CASE WHEN event_type = 'BattleWin' THEN 1 ELSE 0 END)::INTEGER AS win_count,
          SUM(CASE WHEN event_type = 'BattleLose' THEN 1 ELSE 0 END)::INTEGER AS loss_count,
          AVG(CASE WHEN event_type = 'BattleWin' THEN CAST(turn_count AS DOUBLE) END) AS avg_turns
        FROM stage_events
        WHERE stage_id IS NOT NULL AND stage_id <> ''
        GROUP BY 1
        HAVING reach_count > 0
        ORDER BY reach_count DESC
        LIMIT 200
      `;
      return await query<StageStat>(sql);
    },
  });

  return (
    <Stack>
      <Title order={2}>ステージ分析</Title>
      <FilterBar filter={search} navigateTo={{ to: '/stages' }} />
      <QueryError error={error} />
      {isLoading ? (
        <Loader />
      ) : (
        <SortableTable
          columns={COLUMNS}
          rows={rows ?? []}
          rowKey={(r) => r.stage_id}
          defaultSort={{ reach_count: 'desc' }}
        />
      )}
      {rows && rows.length === 0 && <Text c="dimmed">該当するステージなし</Text>}
    </Stack>
  );
}
