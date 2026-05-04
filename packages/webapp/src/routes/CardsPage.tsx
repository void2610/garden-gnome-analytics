import { Card, Loader, Stack, Table, Tabs, Text, Title } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { useSearch } from '@tanstack/react-router';
import { FilterBar } from '../components/FilterBar';
import { QueryError } from '../components/QueryError';
import { useManifest } from '../hooks/useManifest';
import { buildWhere } from '../lib/filter';
import { query } from '../lib/duckdb/query';
import { eventsFrom, runsFrom } from '../queries/runsParquet';

export function CardsPage() {
  const search = useSearch({ from: '/cards' });
  const { data: manifest } = useManifest();
  const filterKey = JSON.stringify(search);

  const { data: usage, isLoading: usageLoading, error: usageError } = useQuery({
    queryKey: ['cards-usage', filterKey, manifest?.generatedAt],
    enabled: !!manifest && manifest.datasets.length > 0,
    queryFn: async () => {
      if (!manifest) return [];
      const where = buildWhere(search);
      // payload 内の cardName/growthStage を JSON 抽出
      const sql = `
        WITH played AS (
          SELECT
            json_extract_string(payload, '$.cardName') AS card_name,
            json_extract_string(payload, '$.growthStage') AS growth_stage,
            run_id
          FROM ${eventsFrom(manifest.datasets)}
          ${where}${where ? ' AND' : 'WHERE'} event_type = 'CardPlayed'
            AND json_extract_string(payload, '$.cardName') IS NOT NULL
        )
        SELECT
          card_name,
          growth_stage,
          COUNT(*)::INTEGER AS use_count,
          COUNT(DISTINCT run_id)::INTEGER AS run_count
        FROM played
        GROUP BY 1, 2
        ORDER BY use_count DESC
        LIMIT 100
      `;
      return await query<{
        card_name: string;
        growth_stage: string;
        use_count: number;
        run_count: number;
      }>(sql);
    },
  });

  const { data: pickRate } = useQuery({
    queryKey: ['cards-pickrate', filterKey, manifest?.generatedAt],
    enabled: !!manifest && manifest.datasets.length > 0,
    queryFn: async () => {
      if (!manifest) return [];
      const where = buildWhere(search);
      const sql = `
        WITH rewards AS (
          SELECT
            json_extract_string(payload, '$.type') AS reward_type,
            json_extract_string(payload, '$.selected') AS selected,
            json_extract_string(payload, '$.choices') AS choices
          FROM ${eventsFrom(manifest.datasets)}
          ${where}${where ? ' AND' : 'WHERE'} event_type = 'RewardSelected'
            AND json_extract_string(payload, '$.type') = 'Card'
        ),
        choices_unnested AS (
          SELECT unnest(string_split(choices, ';')) AS card, selected FROM rewards
        )
        SELECT
          card,
          COUNT(*)::INTEGER AS shown,
          SUM(CASE WHEN card = selected THEN 1 ELSE 0 END)::INTEGER AS picked,
          ROUND(SUM(CASE WHEN card = selected THEN 1 ELSE 0 END)::DOUBLE / NULLIF(COUNT(*), 0) * 100, 1) AS pick_rate_pct
        FROM choices_unnested
        WHERE card IS NOT NULL AND card <> ''
        GROUP BY 1
        ORDER BY shown DESC
        LIMIT 100
      `;
      return await query<{
        card: string;
        shown: number;
        picked: number;
        pick_rate_pct: number;
      }>(sql);
    },
  });

  const { data: outcomeDiff } = useQuery({
    queryKey: ['cards-outcome', filterKey, manifest?.generatedAt],
    enabled: !!manifest && manifest.datasets.length > 0,
    queryFn: async () => {
      if (!manifest) return [];
      const where = buildWhere(search);
      const whereRuns = where.replace(/timestamp/g, 'started_at');
      const sql = `
        WITH played AS (
          SELECT
            run_id,
            json_extract_string(payload, '$.cardName') AS card_name
          FROM ${eventsFrom(manifest.datasets)}
          ${where}${where ? ' AND' : 'WHERE'} event_type = 'CardPlayed'
            AND json_extract_string(payload, '$.cardName') IS NOT NULL
        ),
        outcomes AS (
          SELECT run_id, outcome FROM ${runsFrom(manifest.datasets)}
          ${whereRuns}
        ),
        joined AS (
          SELECT p.card_name, o.outcome
          FROM played p JOIN outcomes o USING (run_id)
        )
        SELECT
          card_name,
          AVG(CASE WHEN outcome = 'win' THEN 1.0 ELSE 0.0 END) AS win_uses_per_run,
          COUNT(*)::INTEGER AS total_uses,
          SUM(CASE WHEN outcome = 'win' THEN 1 ELSE 0 END)::INTEGER AS uses_in_win,
          SUM(CASE WHEN outcome = 'loss' THEN 1 ELSE 0 END)::INTEGER AS uses_in_loss
        FROM joined
        GROUP BY 1
        HAVING total_uses >= 5
        ORDER BY total_uses DESC
        LIMIT 100
      `;
      return await query<{
        card_name: string;
        total_uses: number;
        uses_in_win: number;
        uses_in_loss: number;
      }>(sql);
    },
  });

  return (
    <Stack>
      <Title order={2}>カード分析</Title>
      <FilterBar filter={search} navigateTo={{ to: '/cards' }} />
      <QueryError error={usageError} />

      <Tabs defaultValue="usage">
        <Tabs.List>
          <Tabs.Tab value="usage">使用回数</Tabs.Tab>
          <Tabs.Tab value="pick">リワード選択率</Tabs.Tab>
          <Tabs.Tab value="outcome">勝敗別差分</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="usage" pt="sm">
          {usageLoading ? (
            <Loader />
          ) : (
            <Card withBorder p="xs" style={{ overflowX: 'auto' }}>
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>カード名</Table.Th>
                    <Table.Th>成長段階</Table.Th>
                    <Table.Th>使用回数</Table.Th>
                    <Table.Th>出現ラン数</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {(usage ?? []).map((r) => (
                    <Table.Tr key={`${r.card_name}-${r.growth_stage}`}>
                      <Table.Td>{r.card_name}</Table.Td>
                      <Table.Td>{r.growth_stage}</Table.Td>
                      <Table.Td>{r.use_count.toLocaleString('ja-JP')}</Table.Td>
                      <Table.Td>{r.run_count}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Card>
          )}
        </Tabs.Panel>

        <Tabs.Panel value="pick" pt="sm">
          <Card withBorder p="xs" style={{ overflowX: 'auto' }}>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>カード</Table.Th>
                  <Table.Th>提示回数</Table.Th>
                  <Table.Th>選択回数</Table.Th>
                  <Table.Th>選択率 %</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {(pickRate ?? []).map((r) => (
                  <Table.Tr key={r.card}>
                    <Table.Td>{r.card}</Table.Td>
                    <Table.Td>{r.shown}</Table.Td>
                    <Table.Td>{r.picked}</Table.Td>
                    <Table.Td>{r.pick_rate_pct?.toFixed?.(1) ?? r.pick_rate_pct}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Card>
        </Tabs.Panel>

        <Tabs.Panel value="outcome" pt="sm">
          <Text c="dimmed" size="sm">
            ラン全体の勝敗別カード使用回数 (合計 5 回以上)
          </Text>
          <Card withBorder p="xs" mt="xs" style={{ overflowX: 'auto' }}>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>カード名</Table.Th>
                  <Table.Th>合計使用</Table.Th>
                  <Table.Th>win 使用</Table.Th>
                  <Table.Th>loss 使用</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {(outcomeDiff ?? []).map((r) => (
                  <Table.Tr key={r.card_name}>
                    <Table.Td>{r.card_name}</Table.Td>
                    <Table.Td>{r.total_uses}</Table.Td>
                    <Table.Td>{r.uses_in_win}</Table.Td>
                    <Table.Td>{r.uses_in_loss}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Card>
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}
