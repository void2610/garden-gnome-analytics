import { Card, Loader, Stack, Table, Text, Title } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { useSearch } from '@tanstack/react-router';
import { FilterBar } from '../components/FilterBar';
import { useManifest } from '../hooks/useManifest';
import { buildWhere } from '../lib/filter';
import { query } from '../lib/duckdb/query';
import { eventsFrom } from '../queries/runsParquet';

interface StageStat {
  stage_id: string;
  reach_count: number;
  win_count: number;
  loss_count: number;
  avg_turns: number | null;
}

export function StagesPage() {
  const search = useSearch({ from: '/stages' });
  const { data: manifest } = useManifest();
  const filterKey = JSON.stringify(search);

  const { data: rows, isLoading } = useQuery({
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
      {isLoading ? (
        <Loader />
      ) : (
        <Card withBorder p="xs" style={{ overflowX: 'auto' }}>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>stageId</Table.Th>
                <Table.Th>到達数</Table.Th>
                <Table.Th>勝利数</Table.Th>
                <Table.Th>敗北数</Table.Th>
                <Table.Th>平均ターン数</Table.Th>
                <Table.Th>勝率</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {(rows ?? []).map((r) => {
                const total = r.win_count + r.loss_count;
                const winRate = total > 0 ? ((r.win_count / total) * 100).toFixed(1) : '-';
                return (
                  <Table.Tr key={r.stage_id}>
                    <Table.Td>{r.stage_id}</Table.Td>
                    <Table.Td>{r.reach_count}</Table.Td>
                    <Table.Td>{r.win_count}</Table.Td>
                    <Table.Td>{r.loss_count}</Table.Td>
                    <Table.Td>{r.avg_turns?.toFixed(1) ?? '-'}</Table.Td>
                    <Table.Td>{winRate}%</Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        </Card>
      )}
      {rows && rows.length === 0 && <Text c="dimmed">該当するステージなし</Text>}
    </Stack>
  );
}
