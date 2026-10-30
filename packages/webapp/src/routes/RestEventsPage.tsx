import { Stack, Text, Title } from '@mantine/core';
import { useSearch } from '@tanstack/react-router';
import { EventAggregateTable } from '../components/EventAggregateTable';
import { FilterBar } from '../components/FilterBar';
import type { SortableColumn } from '../components/SortableTable';
import { avgColumn, numberColumn, rateColumn, textColumn } from '../lib/columns';
import { withoutStageSql } from '../queries/cards';
import { payloadText, whereEvents } from '../queries/enemies';

interface RestRow {
  choice: string;
  count: number;
  share: number | null;
  avg_hp_rate: number | null;
  avg_healed: number | null;
}

interface CultivationRow {
  card: string;
  planted: number;
  watered: number;
  fertilized: number;
  cured: number;
  removed: number;
  sick: number;
  withered: number;
  grew: number;
  evolved: number;
  avg_points: number | null;
}

interface OptionRow {
  event_name: string;
  option_index: number;
  shown: number;
  blocked: number;
  selected: number;
  select_rate: number | null;
  lost: number;
}

interface BlockedRow {
  event_name: string;
  option_index: number;
  reason: string;
  count: number;
}

interface ActionRow {
  event_name: string;
  option_index: number;
  action: string;
  executed: number;
  skipped: number;
}

const REST_COLUMNS: SortableColumn<RestRow>[] = [
  textColumn<RestRow>('choice', '選んだこと'),
  numberColumn<RestRow>('count', '回数'),
  rateColumn<RestRow>('share', '割合'),
  rateColumn<RestRow>('avg_hp_rate', '選ぶ前の平均 HP (最大 HP 比)'),
  avgColumn<RestRow>('avg_healed', '平均の回復量'),
];

const CULTIVATION_COLUMNS: SortableColumn<CultivationRow>[] = [
  textColumn<CultivationRow>('card', 'カード'),
  numberColumn<CultivationRow>('planted', '植えた'),
  numberColumn<CultivationRow>('watered', '水やり'),
  numberColumn<CultivationRow>('fertilized', '肥料'),
  numberColumn<CultivationRow>('cured', '治した'),
  numberColumn<CultivationRow>('removed', '抜いた'),
  numberColumn<CultivationRow>('sick', '病気になった'),
  numberColumn<CultivationRow>('withered', '枯れた'),
  numberColumn<CultivationRow>('grew', '成長した'),
  numberColumn<CultivationRow>('evolved', '段階が上がった'),
  avgColumn<CultivationRow>('avg_points', '平均の成長度'),
];

const OPTION_COLUMNS: SortableColumn<OptionRow>[] = [
  textColumn<OptionRow>('event_name', 'イベント'),
  numberColumn<OptionRow>('option_index', '選択肢'),
  numberColumn<OptionRow>('shown', '出た'),
  numberColumn<OptionRow>('blocked', '押せなかった'),
  numberColumn<OptionRow>('selected', '選ばれた'),
  rateColumn<OptionRow>('select_rate', '押せたときに選ばれた割合'),
  numberColumn<OptionRow>('lost', 'その選択で負けた'),
];

const BLOCKED_COLUMNS: SortableColumn<BlockedRow>[] = [
  textColumn<BlockedRow>('event_name', 'イベント'),
  numberColumn<BlockedRow>('option_index', '選択肢'),
  textColumn<BlockedRow>('reason', '理由 (条件か効果の型名)'),
  numberColumn<BlockedRow>('count', '回数'),
];

const ACTION_COLUMNS: SortableColumn<ActionRow>[] = [
  textColumn<ActionRow>('event_name', 'イベント'),
  numberColumn<ActionRow>('option_index', '選択肢'),
  textColumn<ActionRow>('action', '効果 (添字:型名)'),
  numberColumn<ActionRow>('executed', '実行した'),
  numberColumn<ActionRow>('skipped', '飛ばした'),
];

const payloadNumber = (key: string) => `TRY_CAST(json_extract(payload, '$.${key}') AS DOUBLE)`;

const restSql = (from: string, where: string) => `
  SELECT ${payloadText('choice')} AS choice, COUNT(*)::INTEGER AS count,
    COUNT(*) / SUM(COUNT(*)) OVER () AS share,
    AVG(${payloadNumber('hpBefore')} / NULLIF(${payloadNumber('maxHp')}, 0)) AS avg_hp_rate,
    AVG(${payloadNumber('hpAfter')} - ${payloadNumber('hpBefore')}) AS avg_healed
  FROM ${from}
  ${whereEvents(where, ['RestChoice'])}
  GROUP BY 1`;

const cultivationSql = (from: string, where: string) => `
  WITH ev AS (
    SELECT event_type, ${withoutStageSql(payloadText('card'))} AS card,
      ${payloadText('evolved')} AS evolved, ${payloadNumber('points')} AS points
    FROM ${from}
    ${whereEvents(where, [
      'CultivationPlant',
      'CultivationWater',
      'CultivationFertilize',
      'CultivationCure',
      'CultivationRemove',
      'CultivationSick',
      'CultivationWither',
      'CultivationGrowth',
    ])}
  )
  SELECT card,
    COUNT(*) FILTER (WHERE event_type = 'CultivationPlant')::INTEGER AS planted,
    COUNT(*) FILTER (WHERE event_type = 'CultivationWater')::INTEGER AS watered,
    COUNT(*) FILTER (WHERE event_type = 'CultivationFertilize')::INTEGER AS fertilized,
    COUNT(*) FILTER (WHERE event_type = 'CultivationCure')::INTEGER AS cured,
    COUNT(*) FILTER (WHERE event_type = 'CultivationRemove')::INTEGER AS removed,
    COUNT(*) FILTER (WHERE event_type = 'CultivationSick')::INTEGER AS sick,
    COUNT(*) FILTER (WHERE event_type = 'CultivationWither')::INTEGER AS withered,
    COUNT(*) FILTER (WHERE event_type = 'CultivationGrowth')::INTEGER AS grew,
    COUNT(*) FILTER (WHERE event_type = 'CultivationGrowth' AND evolved = 'True')::INTEGER AS evolved,
    AVG(points) FILTER (WHERE event_type = 'CultivationGrowth') AS avg_points
  FROM ev
  GROUP BY 1`;

// 選択肢は「添字:ok」か「添字:blocked(満たしていない最初の条件か、実行できない最初の効果の型名)」を ; で並べたもの
const shownOptionsSql = (from: string, where: string) => `
  shown AS (
    SELECT run_id, ${payloadText('eventName')} AS event_name, unnest(string_split(${payloadText('options')}, ';')) AS entry
    FROM ${from}
    ${whereEvents(where, ['StageEventShown'])}
  ),
  opts AS (
    SELECT run_id, event_name, TRY_CAST(split_part(entry, ':', 1) AS INTEGER) AS option_index,
      regexp_extract(entry, '^[0-9]+:blocked\\((.*)\\)$', 1) AS reason
    FROM shown WHERE entry <> ''
  )`;

// 選択肢の表示を書く前のログの選択は数えない (表示を書いているランの選択だけ)
const optionSql = (from: string, where: string) => `
  WITH ${shownOptionsSql(from, where)},
  offered AS (
    SELECT event_name, option_index, COUNT(*)::INTEGER AS shown,
      COUNT(*) FILTER (WHERE reason <> '')::INTEGER AS blocked
    FROM opts GROUP BY 1, 2
  ),
  picked AS (
    SELECT ${payloadText('eventName')} AS event_name, TRY_CAST(json_extract(payload, '$.optionIndex') AS INTEGER) AS option_index,
      COUNT(*) FILTER (WHERE event_type = 'StageEventSelected')::INTEGER AS selected,
      COUNT(*) FILTER (WHERE event_type = 'StageEventLose')::INTEGER AS lost
    FROM ${from}
    ${whereEvents(where, ['StageEventSelected', 'StageEventLose'])} AND run_id IN (SELECT run_id FROM shown)
    GROUP BY 1, 2
  )
  SELECT o.event_name, o.option_index, o.shown, o.blocked, COALESCE(p.selected, 0)::INTEGER AS selected,
    COALESCE(p.selected, 0) / NULLIF(o.shown - o.blocked, 0) AS select_rate, COALESCE(p.lost, 0)::INTEGER AS lost
  FROM offered o LEFT JOIN picked p USING (event_name, option_index)`;

const blockedSql = (from: string, where: string) => `
  WITH ${shownOptionsSql(from, where)}
  SELECT event_name, option_index, reason, COUNT(*)::INTEGER AS count
  FROM opts WHERE reason <> ''
  GROUP BY 1, 2, 3`;

// 飛ばした効果は、前の効果で状態が変わり実行の直前に使えなくなったもの
const actionSql = (from: string, where: string) => `
  WITH ev AS (
    SELECT ${payloadText('eventName')} AS event_name, TRY_CAST(json_extract(payload, '$.optionIndex') AS INTEGER) AS option_index,
      ${payloadText('executed')} AS executed, ${payloadText('skipped')} AS skipped
    FROM ${from}
    ${whereEvents(where, ['StageEventExecuted'])}
  ),
  acts AS (
    SELECT event_name, option_index, 'executed' AS kind, unnest(string_split(executed, ';')) AS action FROM ev
    UNION ALL SELECT event_name, option_index, 'skipped', unnest(string_split(skipped, ';')) FROM ev
  )
  SELECT event_name, option_index, action,
    COUNT(*) FILTER (WHERE kind = 'executed')::INTEGER AS executed,
    COUNT(*) FILTER (WHERE kind = 'skipped')::INTEGER AS skipped
  FROM acts WHERE action <> ''
  GROUP BY 1, 2, 3`;

export function RestEventsPage() {
  const search = useSearch({ from: '/rest-events' });
  return (
    <Stack gap="xl">
      <Stack gap="xs">
        <Title order={2}>休憩とイベントの分析</Title>
        <Text c="dimmed" size="sm">
          休憩で何を選んだか、畑でカードをどう育てたか、ステージイベントの選択肢がどれだけ押せて選ばれたかを集計する。
          カードは成長段階を外してまとめる。
        </Text>
        <FilterBar filter={search} navigateTo={{ to: '/rest-events' }} />
      </Stack>
      <EventAggregateTable
        title="休憩の選択"
        description="休憩で回復 (Heal)・畑 (Farm)・何もしない (Skip) のどれを選んだか"
        queryKey="rest-choice"
        buildSql={restSql}
        columns={REST_COLUMNS}
        rowKey={(r) => r.choice}
        defaultSort={[{ key: 'count', direction: 'desc' }]}
        filter={search}
      />
      <EventAggregateTable
        title="畑のカード"
        description="畑での操作と、休憩を終えたときの病気・枯れ・成長。成長は休憩を終えるたびに植えてあるカードごとに数える"
        queryKey="rest-cultivation"
        buildSql={cultivationSql}
        columns={CULTIVATION_COLUMNS}
        rowKey={(r) => r.card}
        defaultSort={[{ key: 'planted', direction: 'desc' }]}
        filter={search}
      />
      <EventAggregateTable
        title="ステージイベントの選択肢"
        description="イベントを出したときの選択肢 (StageEventShown) のうち、押せなかった回数と、選ばれた回数 (StageEventSelected)"
        queryKey="rest-event-options"
        buildSql={optionSql}
        columns={OPTION_COLUMNS}
        rowKey={(r) => `${r.event_name}|${r.option_index}`}
        defaultSort={[{ key: 'shown', direction: 'desc' }]}
        filter={search}
      />
      <EventAggregateTable
        title="選択肢を押せなかった理由"
        description="満たしていない最初の条件か、実行できない最初の効果の型名。Not(...) / AnyOf(...) は条件の入れ子"
        queryKey="rest-event-blocked"
        buildSql={blockedSql}
        columns={BLOCKED_COLUMNS}
        rowKey={(r) => `${r.event_name}|${r.option_index}|${r.reason}`}
        defaultSort={[{ key: 'count', direction: 'desc' }]}
        filter={search}
      />
      <EventAggregateTable
        title="選択肢の効果"
        description="選んだ選択肢の効果のうち、実行したものと、前の効果で使えなくなり飛ばしたもの"
        queryKey="rest-event-actions"
        buildSql={actionSql}
        columns={ACTION_COLUMNS}
        rowKey={(r) => `${r.event_name}|${r.option_index}|${r.action}`}
        defaultSort={[{ key: 'executed', direction: 'desc' }]}
        filter={search}
      />
    </Stack>
  );
}
