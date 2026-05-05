import { Loader, Stack, Tabs, Text, Title } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { useSearch } from '@tanstack/react-router';
import { useMemo } from 'react';
import { FilterBar } from '../components/FilterBar';
import { QueryBar } from '../components/QueryBar';
import { QueryError } from '../components/QueryError';
import { SortableTable, type SortableColumn, type SortKey } from '../components/SortableTable';
import { useManifest } from '../hooks/useManifest';
import { useLocalTableQuery } from '../hooks/useTableQuery';
import { buildWhere } from '../lib/filter';
import { query } from '../lib/duckdb/query';
import { localizeCardName, useLocalization } from '../lib/localization';
import { applyTableQuery } from '../lib/tableQuery';
import { eventsFrom, runsFrom } from '../queries/runsParquet';

interface UsageRow {
  card_name: string;
  growth_stage: string;
  use_count: number;
  run_count: number;
}

interface PickRow {
  card: string;
  shown: number;
  picked: number;
  pick_rate_pct: number;
}

interface OutcomeRow {
  card_name: string;
  total_uses: number;
  uses_in_win: number;
  uses_in_loss: number;
}

const USAGE_DEFAULT_SORT: SortKey[] = [{ key: 'use_count', direction: 'desc' }];
const PICK_DEFAULT_SORT: SortKey[] = [{ key: 'shown', direction: 'desc' }];
const OUTCOME_DEFAULT_SORT: SortKey[] = [{ key: 'total_uses', direction: 'desc' }];

export function CardsPage() {
  const search = useSearch({ from: '/cards' });
  const { data: manifest } = useManifest();
  const { data: loc } = useLocalization();
  const cardNames = loc?.cardNames;
  // 列フィルタ/ソートはタブごとに独立 (URL 共有しない)
  const usageTQ = useLocalTableQuery();
  const pickTQ = useLocalTableQuery();
  const outcomeTQ = useLocalTableQuery();

  const filterKey = JSON.stringify({
    events: search.events,
    devices: search.devices,
    dateFrom: search.dateFrom,
    dateTo: search.dateTo,
  });

  const usageColumns = useMemo(() => buildUsageColumns(cardNames), [cardNames]);
  const pickColumns = useMemo(() => buildPickColumns(cardNames), [cardNames]);
  const outcomeColumns = useMemo(() => buildOutcomeColumns(cardNames), [cardNames]);

  const {
    data: usage,
    isLoading: usageLoading,
    error: usageError,
  } = useQuery({
    queryKey: ['cards-usage', filterKey, manifest?.generatedAt],
    enabled: !!manifest && manifest.datasets.length > 0,
    queryFn: async () => {
      if (!manifest) return [];
      const where = buildWhere({
        events: search.events,
        devices: search.devices,
        dateFrom: search.dateFrom,
        dateTo: search.dateTo,
      });
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
      return await query<UsageRow>(sql);
    },
  });

  const { data: pickRate } = useQuery({
    queryKey: ['cards-pickrate', filterKey, manifest?.generatedAt],
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
      return await query<PickRow>(sql);
    },
  });

  const { data: outcomeDiff } = useQuery({
    queryKey: ['cards-outcome', filterKey, manifest?.generatedAt],
    enabled: !!manifest && manifest.datasets.length > 0,
    queryFn: async () => {
      if (!manifest) return [];
      const where = buildWhere({
        events: search.events,
        devices: search.devices,
        dateFrom: search.dateFrom,
        dateTo: search.dateTo,
      });
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
      return await query<OutcomeRow>(sql);
    },
  });

  const usageVisible = useMemo(
    () => applyTableQuery(usage ?? [], usageColumns, { tf: usageTQ.query.tf }),
    [usage, usageColumns, usageTQ.query.tf],
  );
  const pickVisible = useMemo(
    () => applyTableQuery(pickRate ?? [], pickColumns, { tf: pickTQ.query.tf }),
    [pickRate, pickColumns, pickTQ.query.tf],
  );
  const outcomeVisible = useMemo(
    () => applyTableQuery(outcomeDiff ?? [], outcomeColumns, { tf: outcomeTQ.query.tf }),
    [outcomeDiff, outcomeColumns, outcomeTQ.query.tf],
  );

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
          <Stack>
            <QueryBar columns={usageColumns} query={usageTQ.query} onChange={usageTQ.setQuery} />
            {usageLoading ? (
              <Loader />
            ) : (
              <SortableTable
                columns={usageColumns}
                rows={usageVisible}
                rowKey={(r) => `${r.card_name}-${r.growth_stage}`}
                sort={usageTQ.query.ts ?? USAGE_DEFAULT_SORT}
                onSortChange={(s) => usageTQ.setQuery({ ...usageTQ.query, ts: s })}
              />
            )}
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="pick" pt="sm">
          <Stack>
            <QueryBar columns={pickColumns} query={pickTQ.query} onChange={pickTQ.setQuery} />
            <SortableTable
              columns={pickColumns}
              rows={pickVisible}
              rowKey={(r) => r.card}
              sort={pickTQ.query.ts ?? PICK_DEFAULT_SORT}
              onSortChange={(s) => pickTQ.setQuery({ ...pickTQ.query, ts: s })}
            />
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="outcome" pt="sm">
          <Stack>
            <Text c="dimmed" size="sm">
              ラン全体の勝敗別カード使用回数 (合計 5 回以上)
            </Text>
            <QueryBar
              columns={outcomeColumns}
              query={outcomeTQ.query}
              onChange={outcomeTQ.setQuery}
            />
            <SortableTable
              columns={outcomeColumns}
              rows={outcomeVisible}
              rowKey={(r) => r.card_name}
              sort={outcomeTQ.query.ts ?? OUTCOME_DEFAULT_SORT}
              onSortChange={(s) => outcomeTQ.setQuery({ ...outcomeTQ.query, ts: s })}
            />
          </Stack>
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}

function buildUsageColumns(
  cardNames: Record<string, string> | undefined,
): SortableColumn<UsageRow>[] {
  return [
    {
      key: 'card_name',
      label: 'カード名',
      // ソートは日本語名で行う（同名は英名で安定化）
      accessor: (r) => `${cardNames?.[r.card_name] ?? r.card_name}::${r.card_name}`,
      render: (r) => localizeCardName(r.card_name, cardNames),
      // フィルタは英名・日本語名どちらでもヒットさせる
      filter: {
        kind: 'text',
        getValue: (r) => {
          const row = r as UsageRow;
          return `${cardNames?.[row.card_name] ?? row.card_name}\t${row.card_name}`;
        },
      },
    },
    {
      key: 'growth_stage',
      label: '成長段階',
      accessor: (r) => r.growth_stage,
      filter: { kind: 'text' },
    },
    {
      key: 'use_count',
      label: '使用回数',
      accessor: (r) => r.use_count,
      render: (r) => r.use_count.toLocaleString('ja-JP'),
      numeric: true,
      align: 'right',
      filter: { kind: 'number' },
    },
    {
      key: 'run_count',
      label: '出現ラン数',
      accessor: (r) => r.run_count,
      numeric: true,
      align: 'right',
      filter: { kind: 'number' },
    },
  ];
}

function buildPickColumns(
  cardNames: Record<string, string> | undefined,
): SortableColumn<PickRow>[] {
  return [
    {
      key: 'card',
      label: 'カード',
      accessor: (r) => `${cardNames?.[r.card] ?? r.card}::${r.card}`,
      render: (r) => localizeCardName(r.card, cardNames),
      filter: {
        kind: 'text',
        getValue: (r) => {
          const row = r as PickRow;
          return `${cardNames?.[row.card] ?? row.card}\t${row.card}`;
        },
      },
    },
    {
      key: 'shown',
      label: '提示回数',
      accessor: (r) => r.shown,
      numeric: true,
      align: 'right',
      filter: { kind: 'number' },
    },
    {
      key: 'picked',
      label: '選択回数',
      accessor: (r) => r.picked,
      numeric: true,
      align: 'right',
      filter: { kind: 'number' },
    },
    {
      key: 'pick_rate_pct',
      label: '選択率 %',
      accessor: (r) => r.pick_rate_pct,
      render: (r) =>
        typeof r.pick_rate_pct === 'number' ? r.pick_rate_pct.toFixed(1) : String(r.pick_rate_pct),
      numeric: true,
      align: 'right',
      filter: { kind: 'number' },
    },
  ];
}

function buildOutcomeColumns(
  cardNames: Record<string, string> | undefined,
): SortableColumn<OutcomeRow>[] {
  return [
    {
      key: 'card_name',
      label: 'カード名',
      accessor: (r) => `${cardNames?.[r.card_name] ?? r.card_name}::${r.card_name}`,
      render: (r) => localizeCardName(r.card_name, cardNames),
      filter: {
        kind: 'text',
        getValue: (r) => {
          const row = r as OutcomeRow;
          return `${cardNames?.[row.card_name] ?? row.card_name}\t${row.card_name}`;
        },
      },
    },
    {
      key: 'total_uses',
      label: '合計使用',
      accessor: (r) => r.total_uses,
      numeric: true,
      align: 'right',
      filter: { kind: 'number' },
    },
    {
      key: 'uses_in_win',
      label: 'win 使用',
      accessor: (r) => r.uses_in_win,
      numeric: true,
      align: 'right',
      filter: { kind: 'number' },
    },
    {
      key: 'uses_in_loss',
      label: 'loss 使用',
      accessor: (r) => r.uses_in_loss,
      numeric: true,
      align: 'right',
      filter: { kind: 'number' },
    },
  ];
}
