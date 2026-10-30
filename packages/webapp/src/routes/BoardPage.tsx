import { Stack, Text, Title } from '@mantine/core';
import { useSearch } from '@tanstack/react-router';
import { EventAggregateTable } from '../components/EventAggregateTable';
import { FilterBar } from '../components/FilterBar';
import type { SortableColumn } from '../components/SortableTable';
import { avgColumn, numberColumn, textColumn } from '../lib/columns';
import { payloadText, whereEvents } from '../queries/enemies';

interface PlantRow {
  card: string;
  placed: number;
  triggered: number;
  avg_targets: number | null;
  removed_triggered: number;
  removed_expired: number;
  removed_effect: number;
}

interface ObstacleRow {
  obstacle: string;
  placed: number;
  destroyed: number;
  expired: number;
}

interface TreasureRow {
  how: string;
  opened: number;
  failed: number;
}

const PLANT_COLUMNS: SortableColumn<PlantRow>[] = [
  textColumn<PlantRow>('card', '植物'),
  numberColumn<PlantRow>('placed', '置いた'),
  numberColumn<PlantRow>('triggered', '発動'),
  avgColumn<PlantRow>('avg_targets', '発動時の範囲内の対象の平均'),
  numberColumn<PlantRow>('removed_triggered', '効果を使い切って消えた'),
  numberColumn<PlantRow>('removed_expired', 'ターンが尽きて消えた'),
  numberColumn<PlantRow>('removed_effect', 'カード効果などで消えた'),
];

const OBSTACLE_COLUMNS: SortableColumn<ObstacleRow>[] = [
  textColumn<ObstacleRow>('obstacle', '障害物'),
  numberColumn<ObstacleRow>('placed', '効果で置かれた'),
  numberColumn<ObstacleRow>('destroyed', '壊れた'),
  numberColumn<ObstacleRow>('expired', 'ターンが尽きて消えた'),
];

const HOW_JA: Record<string, string> = { Step: '踏んだ', Effect: 'カード効果' };

const TREASURE_COLUMNS: SortableColumn<TreasureRow>[] = [
  textColumn<TreasureRow>('how', '開け方', (r) => HOW_JA[r.how] ?? r.how),
  numberColumn<TreasureRow>('opened', '開けた'),
  numberColumn<TreasureRow>('failed', '開けられなかった'),
];

const plantSql = (from: string, where: string) => `
  WITH ev AS (
    SELECT event_type, ${payloadText('cardName')} AS card, ${payloadText('targets')} AS targets, ${payloadText('reason')} AS reason
    FROM ${from}
    ${whereEvents(where, ['PlantPlaced', 'PlantTriggered', 'PlantRemoved'])}
  )
  SELECT card,
    COUNT(*) FILTER (WHERE event_type = 'PlantPlaced')::INTEGER AS placed,
    COUNT(*) FILTER (WHERE event_type = 'PlantTriggered')::INTEGER AS triggered,
    AVG(CASE WHEN event_type <> 'PlantTriggered' THEN NULL WHEN targets IS NULL OR targets = '' THEN 0 ELSE len(string_split(targets, ';')) END) AS avg_targets,
    COUNT(*) FILTER (WHERE event_type = 'PlantRemoved' AND reason = 'Triggered')::INTEGER AS removed_triggered,
    COUNT(*) FILTER (WHERE event_type = 'PlantRemoved' AND reason = 'Expired')::INTEGER AS removed_expired,
    COUNT(*) FILTER (WHERE event_type = 'PlantRemoved' AND reason = 'Effect')::INTEGER AS removed_effect
  FROM ev GROUP BY 1`;

const obstacleSql = (from: string, where: string) => `
  WITH ev AS (
    SELECT event_type, ${payloadText('obstacle')} AS obstacle, ${payloadText('reason')} AS reason
    FROM ${from}
    ${whereEvents(where, ['ObstaclePlaced', 'ObstacleRemoved'])}
  )
  SELECT obstacle,
    COUNT(*) FILTER (WHERE event_type = 'ObstaclePlaced')::INTEGER AS placed,
    COUNT(*) FILTER (WHERE event_type = 'ObstacleRemoved' AND reason = 'Destroyed')::INTEGER AS destroyed,
    COUNT(*) FILTER (WHERE event_type = 'ObstacleRemoved' AND reason = 'Expired')::INTEGER AS expired
  FROM ev GROUP BY 1`;

// 開け方の無い TreasureCollected は、開け方を記録する前の古いログ
const treasureSql = (from: string, where: string) => `
  WITH ev AS (
    SELECT event_type, COALESCE(${payloadText('how')}, '不明') AS how
    FROM ${from}
    ${whereEvents(where, ['TreasureCollected', 'TreasureOpenFailed'])}
  )
  SELECT how,
    COUNT(*) FILTER (WHERE event_type = 'TreasureCollected')::INTEGER AS opened,
    COUNT(*) FILTER (WHERE event_type = 'TreasureOpenFailed')::INTEGER AS failed
  FROM ev GROUP BY 1`;

export function BoardPage() {
  const search = useSearch({ from: '/board' });
  return (
    <Stack gap="xl">
      <Stack gap="xs">
        <Title order={2}>盤面の分析</Title>
        <Text c="dimmed" size="sm">
          戦闘のマップに置かれる植物・障害物・宝箱がどう使われたか。植物の発動は、ゲームが効果の結果
          (ダメージや状態異常の増減) から求めて書くので、範囲に何もいなかった発動は数に入らない。
        </Text>
        <FilterBar filter={search} navigateTo={{ to: '/board' }} />
      </Stack>
      <EventAggregateTable
        title="植物"
        queryKey="board-plants"
        buildSql={plantSql}
        columns={PLANT_COLUMNS}
        rowKey={(r) => r.card}
        defaultSort={[{ key: 'placed', direction: 'desc' }]}
        filter={search}
      />
      <EventAggregateTable
        title="障害物"
        description="マップの初期配置は数えず、戦闘中に効果で置かれたものと、除かれたもの"
        queryKey="board-obstacles"
        buildSql={obstacleSql}
        columns={OBSTACLE_COLUMNS}
        rowKey={(r) => r.obstacle}
        defaultSort={[{ key: 'placed', direction: 'desc' }]}
        filter={search}
      />
      <EventAggregateTable
        title="戦闘中の宝箱"
        description="開けられなかったのは、アイテム欄が満杯などのとき"
        queryKey="board-treasures"
        buildSql={treasureSql}
        columns={TREASURE_COLUMNS}
        rowKey={(r) => r.how}
        defaultSort={[{ key: 'opened', direction: 'desc' }]}
        filter={search}
      />
    </Stack>
  );
}
