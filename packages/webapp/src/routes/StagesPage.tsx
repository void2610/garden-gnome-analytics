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
  stage_type: string;
  reach_count: number;
  win_count: number;
  loss_count: number;
  avg_turns: number | null;
  avg_remain_hp: number | null;
  avg_damage: number | null;
  avg_elapsed_sec: number | null;
}

const STAGE_TYPE_JA: Record<string, string> = {
  Battle: 'バトル',
  Boss: 'ボス',
  Rest: '休憩',
  Event: 'イベント',
  Shop: 'ショップ',
  Treasure: '宝箱',
};

const COLUMNS: SortableColumn<StageStat>[] = [
  {
    key: 'stage_type',
    label: 'ステージ種別',
    accessor: (r) => r.stage_type,
    render: (r) => `${STAGE_TYPE_JA[r.stage_type] ?? r.stage_type} (${r.stage_type})`,
  },
  {
    key: 'reach_count',
    label: '到達数',
    accessor: (r) => r.reach_count,
    numeric: true,
    align: 'right',
  },
  {
    key: 'win_count',
    label: '勝利数',
    accessor: (r) => r.win_count,
    render: (r) => (r.win_count > 0 || r.loss_count > 0 ? r.win_count : '-'),
    numeric: true,
    align: 'right',
  },
  {
    key: 'loss_count',
    label: '敗北数',
    accessor: (r) => r.loss_count,
    render: (r) => (r.win_count > 0 || r.loss_count > 0 ? r.loss_count : '-'),
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
  {
    key: 'avg_turns',
    label: '平均ターン',
    accessor: (r) => r.avg_turns,
    render: (r) => (r.avg_turns != null ? r.avg_turns.toFixed(1) : '-'),
    numeric: true,
    align: 'right',
  },
  {
    key: 'avg_remain_hp',
    label: '平均HP残',
    accessor: (r) => r.avg_remain_hp,
    render: (r) => (r.avg_remain_hp != null ? r.avg_remain_hp.toFixed(1) : '-'),
    numeric: true,
    align: 'right',
  },
  {
    key: 'avg_damage',
    label: '平均被ダメ',
    accessor: (r) => r.avg_damage,
    render: (r) => (r.avg_damage != null ? r.avg_damage.toFixed(1) : '-'),
    numeric: true,
    align: 'right',
  },
  {
    key: 'avg_elapsed_sec',
    label: '平均所要(秒)',
    accessor: (r) => r.avg_elapsed_sec,
    render: (r) => (r.avg_elapsed_sec != null ? r.avg_elapsed_sec.toFixed(1) : '-'),
    numeric: true,
    align: 'right',
  },
];

export function StagesPage() {
  const search = useSearch({ from: '/stages' });
  const { data: manifest } = useManifest();
  const filterKey = JSON.stringify(search);

  const { data: rows, isLoading, error } = useQuery({
    queryKey: ['stages-stats-by-type', filterKey, manifest?.generatedAt],
    enabled: !!manifest && manifest.datasets.length > 0,
    queryFn: async () => {
      if (!manifest) return [];
      const where = buildWhere(search);
      // BattleWin/Lose の payload には stageId/stageType が入っていないので、
      // 各 run 内で StageEnter の stageType を window 関数で後続行に前方フィルする
      // elapsedTime は "62.3s" 形式の文字列なので末尾 's' を取って数値化
      const sql = `
        WITH ev AS (
          SELECT
            event_slug,
            device_slug,
            run_id,
            seq,
            event_type,
            json_extract_string(payload, '$.stageType') AS direct_stage_type,
            json_extract(payload, '$.turnCount') AS turn_count,
            json_extract(payload, '$.remainHp') AS remain_hp,
            json_extract(payload, '$.maxHp') AS max_hp,
            json_extract_string(payload, '$.elapsedTime') AS elapsed_str
          FROM ${eventsFrom(manifest.datasets)}
          ${where}
        ),
        filled AS (
          SELECT
            *,
            LAST_VALUE(direct_stage_type IGNORE NULLS) OVER (
              PARTITION BY event_slug, device_slug, run_id
              ORDER BY seq
              ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
            ) AS stage_type
          FROM ev
        )
        SELECT
          stage_type,
          SUM(CASE WHEN event_type = 'StageEnter' THEN 1 ELSE 0 END)::INTEGER AS reach_count,
          SUM(CASE WHEN event_type = 'BattleWin' THEN 1 ELSE 0 END)::INTEGER AS win_count,
          SUM(CASE WHEN event_type = 'BattleLose' THEN 1 ELSE 0 END)::INTEGER AS loss_count,
          AVG(CASE WHEN event_type = 'BattleWin' THEN CAST(turn_count AS DOUBLE) END) AS avg_turns,
          AVG(CASE WHEN event_type = 'BattleWin' THEN CAST(remain_hp AS DOUBLE) END) AS avg_remain_hp,
          AVG(CASE WHEN event_type = 'BattleWin' THEN CAST(max_hp AS DOUBLE) - CAST(remain_hp AS DOUBLE) END) AS avg_damage,
          AVG(
            CASE WHEN event_type IN ('BattleWin', 'BattleLose')
                 THEN TRY_CAST(REGEXP_REPLACE(elapsed_str, 's$', '') AS DOUBLE) END
          ) AS avg_elapsed_sec
        FROM filled
        WHERE stage_type IS NOT NULL AND stage_type <> ''
        GROUP BY 1
        HAVING reach_count > 0
        ORDER BY reach_count DESC
      `;
      return await query<StageStat>(sql);
    },
  });

  return (
    <Stack>
      <Title order={2}>ステージ分析</Title>
      <Text c="dimmed" size="sm">
        ステージ種別ごとの到達回数と、戦闘ステージは勝敗・ターン・HP・所要時間も集計
      </Text>
      <FilterBar filter={search} navigateTo={{ to: '/stages' }} />
      <QueryError error={error} />
      {isLoading ? (
        <Loader />
      ) : (
        <SortableTable
          columns={COLUMNS}
          rows={rows ?? []}
          rowKey={(r) => r.stage_type}
          defaultSort={{ key: 'reach_count', direction: 'desc' }}
        />
      )}
      {rows && rows.length === 0 && <Text c="dimmed">該当するステージなし</Text>}
    </Stack>
  );
}
