import { Stack, Text, Title } from '@mantine/core';
import { useSearch } from '@tanstack/react-router';
import { EventAggregateTable } from '../components/EventAggregateTable';
import { FilterBar } from '../components/FilterBar';
import type { SortableColumn } from '../components/SortableTable';
import { numberColumn, rateColumn, textColumn } from '../lib/columns';
import { enemyAssetSql, payloadText, whereEvents } from '../queries/enemies';

interface EnemyRow {
  enemy: string;
  spawns: number;
  actions: number;
  in_range_rate: number | null;
  interrupted: number;
  skipped: number;
  confused: number;
  defeated: number;
  damage_to_player: number;
}

interface ActionRow {
  enemy: string;
  action: string;
  action_type: string;
  intents: number;
  actions: number;
  in_range_rate: number | null;
}

interface ReasonRow {
  enemy: string;
  kind: string;
  reason: string;
  count: number;
}

const ENEMY_COLUMNS: SortableColumn<EnemyRow>[] = [
  textColumn<EnemyRow>('enemy', '敵'),
  numberColumn<EnemyRow>('spawns', '出現'),
  numberColumn<EnemyRow>('actions', '行動'),
  rateColumn<EnemyRow>('in_range_rate', '行動時に射程内'),
  numberColumn<EnemyRow>('interrupted', '行動の中断'),
  numberColumn<EnemyRow>('skipped', '行動不能'),
  numberColumn<EnemyRow>('confused', '混乱'),
  numberColumn<EnemyRow>('defeated', '撃破された'),
  numberColumn<EnemyRow>('damage_to_player', 'プレイヤーへのダメージ'),
];

const ACTION_COLUMNS: SortableColumn<ActionRow>[] = [
  textColumn<ActionRow>('enemy', '敵'),
  textColumn<ActionRow>('action', '行動'),
  textColumn<ActionRow>('action_type', '実装'),
  numberColumn<ActionRow>('intents', '予告'),
  numberColumn<ActionRow>('actions', '実行'),
  rateColumn<ActionRow>('in_range_rate', '実行時に射程内'),
];

const REASON_COLUMNS: SortableColumn<ReasonRow>[] = [
  textColumn<ReasonRow>('enemy', '敵'),
  textColumn<ReasonRow>('kind', '種類'),
  textColumn<ReasonRow>('reason', '理由'),
  numberColumn<ReasonRow>('count', '回数'),
];

const enemySql = (from: string, where: string) => `
  WITH ev AS (
    SELECT event_type,
      ${payloadText('enemy')} AS enemy_id,
      ${payloadText('playerInRange')} AS in_range,
      ${payloadText('source')} AS src,
      TRY_CAST(json_extract(payload, '$.actualDamage') AS INTEGER) AS actual
    FROM ${from}
    ${whereEvents(where, ['EnemySpawned', 'EnemyAction', 'EnemyActionInterrupted', 'EnemyTurnSkipped', 'EnemyConfused', 'EnemyDefeated', 'PlayerDamaged'])}
  ),
  per_enemy AS (
    SELECT ${enemyAssetSql('enemy_id')} AS enemy,
      COUNT(*) FILTER (WHERE event_type = 'EnemySpawned')::INTEGER AS spawns,
      COUNT(*) FILTER (WHERE event_type = 'EnemyAction')::INTEGER AS actions,
      COUNT(*) FILTER (WHERE event_type = 'EnemyAction' AND lower(in_range) = 'true')::INTEGER AS in_range,
      COUNT(*) FILTER (WHERE event_type = 'EnemyActionInterrupted')::INTEGER AS interrupted,
      COUNT(*) FILTER (WHERE event_type = 'EnemyTurnSkipped')::INTEGER AS skipped,
      COUNT(*) FILTER (WHERE event_type = 'EnemyConfused')::INTEGER AS confused,
      COUNT(*) FILTER (WHERE event_type = 'EnemyDefeated')::INTEGER AS defeated
    FROM ev WHERE enemy_id IS NOT NULL GROUP BY 1
  ),
  damage AS (
    SELECT ${enemyAssetSql("split_part(src, ':', 2)")} AS enemy, COALESCE(SUM(actual), 0)::INTEGER AS damage_to_player
    FROM ev WHERE event_type = 'PlayerDamaged' AND starts_with(src, 'Enemy:') GROUP BY 1
  )
  SELECT p.*, CASE WHEN p.actions > 0 THEN p.in_range / p.actions END AS in_range_rate,
    COALESCE(d.damage_to_player, 0)::INTEGER AS damage_to_player
  FROM per_enemy p LEFT JOIN damage d USING (enemy)`;

const actionSql = (from: string, where: string) => `
  WITH ev AS (
    SELECT event_type, ${enemyAssetSql(payloadText('enemy'))} AS enemy,
      ${payloadText('action')} AS action, ${payloadText('actionType')} AS action_type,
      ${payloadText('playerInRange')} AS in_range
    FROM ${from}
    ${whereEvents(where, ['EnemyIntent', 'EnemyAction'])}
  )
  SELECT enemy, action, ANY_VALUE(action_type) AS action_type,
    COUNT(*) FILTER (WHERE event_type = 'EnemyIntent')::INTEGER AS intents,
    COUNT(*) FILTER (WHERE event_type = 'EnemyAction')::INTEGER AS actions,
    CASE WHEN COUNT(*) FILTER (WHERE event_type = 'EnemyAction') > 0
      THEN COUNT(*) FILTER (WHERE event_type = 'EnemyAction' AND lower(in_range) = 'true') / COUNT(*) FILTER (WHERE event_type = 'EnemyAction')
    END AS in_range_rate
  FROM ev GROUP BY 1, 2`;

const reasonSql = (from: string, where: string) => `
  SELECT ${enemyAssetSql(payloadText('enemy'))} AS enemy,
    CASE event_type WHEN 'EnemyTurnSkipped' THEN '行動不能' ELSE '行動の中断' END AS kind,
    ${payloadText('reason')} AS reason, COUNT(*)::INTEGER AS count
  FROM ${from}
  ${whereEvents(where, ['EnemyTurnSkipped', 'EnemyActionInterrupted'])}
  GROUP BY 1, 2, 3`;

export function EnemiesPage() {
  const search = useSearch({ from: '/enemies' });
  return (
    <Stack gap="xl">
      <Stack gap="xs">
        <Title order={2}>敵の分析</Title>
        <Text c="dimmed" size="sm">
          敵のターンの記録から、敵ごと・行動ごとに集計する。敵は戦闘内の通し番号を外してアセット名ごとにまとめる。
          「射程内」は、行動したときにプレイヤーが攻撃の範囲に入っていた割合。
        </Text>
        <FilterBar filter={search} navigateTo={{ to: '/enemies' }} />
      </Stack>
      <EventAggregateTable
        title="敵ごと"
        queryKey="enemies-by-enemy"
        buildSql={enemySql}
        columns={ENEMY_COLUMNS}
        rowKey={(r) => r.enemy}
        defaultSort={[{ key: 'spawns', direction: 'desc' }]}
        filter={search}
      />
      <EventAggregateTable
        title="行動ごと"
        description="予告はプレイヤーのターンの始めに見せた次の行動 (EnemyIntent)、実行は実際に行った行動 (EnemyAction)"
        queryKey="enemies-by-action"
        buildSql={actionSql}
        columns={ACTION_COLUMNS}
        rowKey={(r) => `${r.enemy}|${r.action}`}
        defaultSort={[{ key: 'actions', direction: 'desc' }]}
        filter={search}
      />
      <EventAggregateTable
        title="行動できなかった理由"
        description="行動不能は状態異常でターンごと行動できなかったもの、行動の中断は射程に入る移動の途中でやめたもの"
        queryKey="enemies-reasons"
        buildSql={reasonSql}
        columns={REASON_COLUMNS}
        rowKey={(r) => `${r.enemy}|${r.kind}|${r.reason}`}
        defaultSort={[{ key: 'count', direction: 'desc' }]}
        filter={search}
      />
    </Stack>
  );
}
