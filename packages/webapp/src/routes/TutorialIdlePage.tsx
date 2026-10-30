import { Stack, Text, Title } from '@mantine/core';
import { useSearch } from '@tanstack/react-router';
import { EventAggregateTable } from '../components/EventAggregateTable';
import { FilterBar } from '../components/FilterBar';
import type { SortableColumn } from '../components/SortableTable';
import { avgColumn, numberColumn, rateColumn, textColumn } from '../lib/columns';
import { payloadText, whereEvents } from '../queries/enemies';

interface StepRow {
  step_id: string;
  page_count: number | null;
  shown: number;
  closed: number;
  close_rate: number | null;
  avg_seconds: number | null;
  avg_seconds_per_page: number | null;
}

interface IdleRow {
  prev_type: string;
  paused: number;
  resumed: number;
  returned: number;
  avg_seconds: number | null;
}

const STEP_COLUMNS: SortableColumn<StepRow>[] = [
  textColumn<StepRow>('step_id', 'ステップ'),
  numberColumn<StepRow>('page_count', 'ページ数'),
  numberColumn<StepRow>('shown', '出した'),
  numberColumn<StepRow>('closed', '最後まで送って閉じた'),
  rateColumn<StepRow>('close_rate', '閉じた割合'),
  avgColumn<StepRow>('avg_seconds', '閉じるまでの平均秒数'),
  avgColumn<StepRow>('avg_seconds_per_page', '1 ページあたりの平均秒数'),
];

const IDLE_COLUMNS: SortableColumn<IdleRow>[] = [
  textColumn<IdleRow>('prev_type', '放置の前の出来事'),
  numberColumn<IdleRow>('paused', '放置された'),
  numberColumn<IdleRow>('resumed', '操作が戻った'),
  numberColumn<IdleRow>('returned', 'タイトルへ戻された'),
  avgColumn<IdleRow>('avg_seconds', '戻るまでの平均秒数'),
];

const secondsBetween = (from: string, to: string) =>
  `date_diff('millisecond', ${from}, ${to}) / 1000.0`;

const stepSql = (from: string, where: string) => `
  WITH ev AS (
    SELECT run_id, seq, timestamp, event_type, ${payloadText('stepId')} AS step_id,
      TRY_CAST(json_extract(payload, '$.pageCount') AS INTEGER) AS page_count
    FROM ${from}
    ${whereEvents(where, ['TutorialStepShown', 'TutorialStepClosed'])}
  ),
  paired AS (
    SELECT *, LEAD(event_type) OVER w AS next_type, LEAD(timestamp) OVER w AS next_at
    FROM ev
    WINDOW w AS (PARTITION BY run_id, step_id ORDER BY seq)
  ),
  steps AS (
    SELECT step_id, MAX(page_count) AS page_count,
      COUNT(*) FILTER (WHERE event_type = 'TutorialStepShown')::INTEGER AS shown,
      COUNT(*) FILTER (WHERE event_type = 'TutorialStepClosed')::INTEGER AS closed,
      AVG(${secondsBetween('timestamp', 'next_at')})
        FILTER (WHERE event_type = 'TutorialStepShown' AND next_type = 'TutorialStepClosed') AS avg_seconds
    FROM paired
    GROUP BY 1
  )
  SELECT *, closed / NULLIF(shown, 0) AS close_rate, avg_seconds / NULLIF(page_count, 0) AS avg_seconds_per_page
  FROM steps`;

// 放置の直後に書かれたのが IdleResumed なら操作が戻り、IdleReturn で終わった SessionEnd ならタイトルへ戻された
const idleSql = (from: string, where: string) => `
  WITH ev AS (
    SELECT event_type, timestamp,
      last_value(CASE WHEN event_type NOT IN ('IdlePaused', 'IdleResumed') THEN event_type END IGNORE NULLS)
        OVER (PARTITION BY run_id ORDER BY seq ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING) AS prev_type,
      LEAD(event_type) OVER w AS next_type, LEAD(timestamp) OVER w AS next_at,
      LEAD(${payloadText('result')}) OVER w AS next_result
    FROM ${from}
    ${where}
    WINDOW w AS (PARTITION BY run_id ORDER BY seq)
  )
  SELECT COALESCE(prev_type, '(ランの最初)') AS prev_type, COUNT(*)::INTEGER AS paused,
    COUNT(*) FILTER (WHERE next_type = 'IdleResumed')::INTEGER AS resumed,
    COUNT(*) FILTER (WHERE next_type = 'SessionEnd' AND next_result = 'IdleReturn')::INTEGER AS returned,
    AVG(${secondsBetween('timestamp', 'next_at')}) FILTER (WHERE next_type = 'IdleResumed') AS avg_seconds
  FROM ev
  WHERE event_type = 'IdlePaused'
  GROUP BY 1`;

export function TutorialIdlePage() {
  const search = useSearch({ from: '/tutorial-idle' });
  return (
    <Stack gap="xl">
      <Stack gap="xs">
        <Title order={2}>チュートリアルと放置の分析</Title>
        <Text c="dimmed" size="sm">
          チュートリアルのステップを最後まで読んだか、展示モードでどこで放置され、操作が戻ったかを集計する。
        </Text>
        <FilterBar filter={search} navigateTo={{ to: '/tutorial-idle' }} />
      </Stack>
      <EventAggregateTable
        title="チュートリアルのステップ"
        description="ステップを出した回数 (TutorialStepShown) と、最後のページまで送って閉じた回数 (TutorialStepClosed)。秒数は出してから閉じるまで"
        queryKey="tutorial-steps"
        buildSql={stepSql}
        columns={STEP_COLUMNS}
        rowKey={(r) => r.step_id}
        defaultSort={[{ key: 'shown', direction: 'desc' }]}
        filter={search}
      />
      <EventAggregateTable
        title="展示モードの放置"
        description="放置のオーバーレイが出た (IdlePaused) ときに、その前に書かれていた出来事ごとの回数。戻るまでの秒数はオーバーレイが出てから操作が戻るまで"
        queryKey="tutorial-idle"
        buildSql={idleSql}
        columns={IDLE_COLUMNS}
        rowKey={(r) => r.prev_type}
        defaultSort={[{ key: 'paused', direction: 'desc' }]}
        filter={search}
      />
    </Stack>
  );
}
