import { Stack, Text, Title } from '@mantine/core';
import { useSearch } from '@tanstack/react-router';
import { EventAggregateTable } from '../components/EventAggregateTable';
import { FilterBar } from '../components/FilterBar';
import type { SortableColumn } from '../components/SortableTable';
import { causeDetailSql, causeKindLabel, causeKindSql } from '../queries/causes';

interface CauseRow {
  kind: string;
  detail: string;
}

interface DamageRow extends CauseRow {
  hits: number;
  total_damage: number;
  total_blocked: number;
  runs: number;
}

interface CountRow extends CauseRow {
  count: number;
  runs: number;
}

interface StatusRow extends CauseRow {
  target_kind: string;
  type: string;
  change: string;
  count: number;
  total_delta: number;
}

const causeColumns = <T extends CauseRow>(): SortableColumn<T>[] => [
  {
    key: 'kind',
    label: '原因の種類',
    accessor: (r) => r.kind,
    render: (r) => causeKindLabel(r.kind),
    filter: { kind: 'text' },
  },
  { key: 'detail', label: '原因', accessor: (r) => r.detail, filter: { kind: 'text' } },
];

const numberColumn = <T,>(key: keyof T & string, label: string): SortableColumn<T> => ({
  key,
  label,
  accessor: (r) => r[key] as number,
  numeric: true,
  align: 'right',
  filter: { kind: 'number' },
});

const DAMAGE_COLUMNS: SortableColumn<DamageRow>[] = [
  ...causeColumns<DamageRow>(),
  numberColumn<DamageRow>('hits', '回数'),
  numberColumn<DamageRow>('total_damage', 'HP に入ったダメージ'),
  numberColumn<DamageRow>('total_blocked', 'ブロックで防いだ量'),
  numberColumn<DamageRow>('runs', 'ラン数'),
];

const COUNT_COLUMNS: SortableColumn<CountRow>[] = [
  ...causeColumns<CountRow>(),
  numberColumn<CountRow>('count', '回数'),
  numberColumn<CountRow>('runs', 'ラン数'),
];

const STATUS_COLUMNS: SortableColumn<StatusRow>[] = [
  { key: 'target_kind', label: '対象', accessor: (r) => r.target_kind, filter: { kind: 'text' } },
  { key: 'type', label: '状態異常', accessor: (r) => r.type, filter: { kind: 'text' } },
  { key: 'change', label: '増減', accessor: (r) => r.change, filter: { kind: 'text' } },
  ...causeColumns<StatusRow>(),
  numberColumn<StatusRow>('count', '回数'),
  numberColumn<StatusRow>('total_delta', 'スタックの増減の合計'),
];

const causeKey = (r: CauseRow) => `${r.kind}|${r.detail}`;

// 指定イベントの原因の列で数える
function countByCauseSql(eventType: string, causeKey: string) {
  return (from: string, where: string) => `
    WITH ev AS (
      SELECT run_id, json_extract_string(payload, '$.${causeKey}') AS src
      FROM ${from}
      ${where ? `${where} AND` : 'WHERE'} event_type = '${eventType}'
    )
    SELECT ${causeKindSql('src')} AS kind, ${causeDetailSql('src')} AS detail,
      COUNT(*)::INTEGER AS count, COUNT(DISTINCT run_id)::INTEGER AS runs
    FROM ev GROUP BY 1, 2`;
}

function damageByCauseSql(eventType: string) {
  return (from: string, where: string) => `
    WITH ev AS (
      SELECT run_id,
        json_extract_string(payload, '$.source') AS src,
        TRY_CAST(json_extract(payload, '$.actualDamage') AS INTEGER) AS actual,
        TRY_CAST(json_extract(payload, '$.blockedDamage') AS INTEGER) AS blocked
      FROM ${from}
      ${where ? `${where} AND` : 'WHERE'} event_type = '${eventType}'
    )
    SELECT ${causeKindSql('src')} AS kind, ${causeDetailSql('src')} AS detail,
      COUNT(*)::INTEGER AS hits,
      COALESCE(SUM(actual), 0)::INTEGER AS total_damage,
      COALESCE(SUM(blocked), 0)::INTEGER AS total_blocked,
      COUNT(DISTINCT run_id)::INTEGER AS runs
    FROM ev GROUP BY 1, 2`;
}

const statusSql = (from: string, where: string) => `
  WITH ev AS (
    SELECT
      CASE WHEN json_extract_string(payload, '$.target') = 'Player' THEN 'プレイヤー' ELSE '敵' END AS target_kind,
      json_extract_string(payload, '$.type') AS type,
      json_extract_string(payload, '$.change') AS change,
      TRY_CAST(json_extract(payload, '$.delta') AS INTEGER) AS delta,
      json_extract_string(payload, '$.source') AS src
    FROM ${from}
    ${where ? `${where} AND` : 'WHERE'} event_type = 'StatusEffectChanged'
  )
  SELECT target_kind, type, change, ${causeKindSql('src')} AS kind, ${causeDetailSql('src')} AS detail,
    COUNT(*)::INTEGER AS count, COALESCE(SUM(delta), 0)::INTEGER AS total_delta
  FROM ev GROUP BY 1, 2, 3, 4, 5`;

export function CausesPage() {
  const search = useSearch({ from: '/causes' });
  return (
    <Stack gap="xl">
      <Stack gap="xs">
        <Title order={2}>原因分析</Title>
        <Text c="dimmed" size="sm">
          戦闘のダメージ・撃破・敗北・状態異常の増減が、何によって起きたか。原因はゲームが記録した
          「種類:詳細」で、敵は戦闘内の通し番号を外してアセット名ごとにまとめる。古いログは原因を表示名で書いているので、表示名がそのまま種類の列に出る。
        </Text>
        <FilterBar filter={search} navigateTo={{ to: '/causes' }} />
      </Stack>
      <EventAggregateTable
        title="負けた原因"
        description="戦闘で負けたときに、最後に HP を減らしたもの (BattleLose の cause)"
        queryKey="causes-battle-lose"
        buildSql={countByCauseSql('BattleLose', 'cause')}
        columns={COUNT_COLUMNS}
        rowKey={causeKey}
        defaultSort={[{ key: 'count', direction: 'desc' }]}
        filter={search}
      />
      <EventAggregateTable
        title="プレイヤーが受けたダメージの原因"
        queryKey="causes-player-damaged"
        buildSql={damageByCauseSql('PlayerDamaged')}
        columns={DAMAGE_COLUMNS}
        rowKey={causeKey}
        defaultSort={[{ key: 'total_damage', direction: 'desc' }]}
        filter={search}
      />
      <EventAggregateTable
        title="敵が受けたダメージの原因"
        queryKey="causes-enemy-damage-taken"
        buildSql={damageByCauseSql('EnemyDamageTaken')}
        columns={DAMAGE_COLUMNS}
        rowKey={causeKey}
        defaultSort={[{ key: 'total_damage', direction: 'desc' }]}
        filter={search}
      />
      <EventAggregateTable
        title="敵を倒した原因"
        description="敵の HP を最後に減らしたもの (EnemyDefeated の killedBy)"
        queryKey="causes-enemy-defeated"
        buildSql={countByCauseSql('EnemyDefeated', 'killedBy')}
        columns={COUNT_COLUMNS}
        rowKey={causeKey}
        defaultSort={[{ key: 'count', direction: 'desc' }]}
        filter={search}
      />
      <EventAggregateTable
        title="状態異常の増減と原因"
        queryKey="causes-status-effect-changed"
        buildSql={statusSql}
        columns={STATUS_COLUMNS}
        rowKey={(r) => `${r.target_kind}|${r.type}|${r.change}|${r.kind}|${r.detail}`}
        defaultSort={[{ key: 'count', direction: 'desc' }]}
        filter={search}
      />
    </Stack>
  );
}
