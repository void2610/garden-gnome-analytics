import { Loader, Stack, Tabs, Text, Title } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { useSearch } from '@tanstack/react-router';
import { FilterBar } from '../components/FilterBar';
import { QueryError } from '../components/QueryError';
import { SortableTable, type SortableColumn } from '../components/SortableTable';
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
            <SortableTable
              columns={USAGE_COLUMNS}
              rows={usage ?? []}
              rowKey={(r) => `${r.card_name}-${r.growth_stage}`}
              defaultSort={{ key: 'use_count', direction: 'desc' }}
            />
          )}
        </Tabs.Panel>

        <Tabs.Panel value="pick" pt="sm">
          <SortableTable
            columns={PICK_COLUMNS}
            rows={pickRate ?? []}
            rowKey={(r) => r.card}
            defaultSort={{ key: 'shown', direction: 'desc' }}
          />
        </Tabs.Panel>

        <Tabs.Panel value="outcome" pt="sm">
          <Text c="dimmed" size="sm">
            ラン全体の勝敗別カード使用回数 (合計 5 回以上)
          </Text>
          <div style={{ marginTop: 8 }}>
            <SortableTable
              columns={OUTCOME_COLUMNS}
              rows={outcomeDiff ?? []}
              rowKey={(r) => r.card_name}
              defaultSort={{ key: 'total_uses', direction: 'desc' }}
            />
          </div>
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}

interface UsageRow {
  card_name: string;
  growth_stage: string;
  use_count: number;
  run_count: number;
}

const USAGE_COLUMNS: SortableColumn<UsageRow>[] = [
  { key: 'card_name', label: 'カード名', accessor: (r) => r.card_name },
  { key: 'growth_stage', label: '成長段階', accessor: (r) => r.growth_stage },
  {
    key: 'use_count',
    label: '使用回数',
    accessor: (r) => r.use_count,
    render: (r) => r.use_count.toLocaleString('ja-JP'),
    numeric: true,
    align: 'right',
  },
  { key: 'run_count', label: '出現ラン数', accessor: (r) => r.run_count, numeric: true, align: 'right' },
];

interface PickRow {
  card: string;
  shown: number;
  picked: number;
  pick_rate_pct: number;
}

const PICK_COLUMNS: SortableColumn<PickRow>[] = [
  { key: 'card', label: 'カード', accessor: (r) => r.card },
  { key: 'shown', label: '提示回数', accessor: (r) => r.shown, numeric: true, align: 'right' },
  { key: 'picked', label: '選択回数', accessor: (r) => r.picked, numeric: true, align: 'right' },
  {
    key: 'pick_rate_pct',
    label: '選択率 %',
    accessor: (r) => r.pick_rate_pct,
    render: (r) =>
      typeof r.pick_rate_pct === 'number' ? r.pick_rate_pct.toFixed(1) : String(r.pick_rate_pct),
    numeric: true,
    align: 'right',
  },
];

interface OutcomeRow {
  card_name: string;
  total_uses: number;
  uses_in_win: number;
  uses_in_loss: number;
}

const OUTCOME_COLUMNS: SortableColumn<OutcomeRow>[] = [
  { key: 'card_name', label: 'カード名', accessor: (r) => r.card_name },
  { key: 'total_uses', label: '合計使用', accessor: (r) => r.total_uses, numeric: true, align: 'right' },
  { key: 'uses_in_win', label: 'win 使用', accessor: (r) => r.uses_in_win, numeric: true, align: 'right' },
  { key: 'uses_in_loss', label: 'loss 使用', accessor: (r) => r.uses_in_loss, numeric: true, align: 'right' },
];
