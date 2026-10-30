import { Stack, Text, Title } from '@mantine/core';
import { useSearch } from '@tanstack/react-router';
import { EventAggregateTable } from '../components/EventAggregateTable';
import { FilterBar } from '../components/FilterBar';
import type { SortableColumn } from '../components/SortableTable';
import { avgColumn, numberColumn, rateColumn, textColumn } from '../lib/columns';
import { payloadText, whereEvents } from '../queries/enemies';

interface NodeRow {
  node_type: string;
  offered: number;
  chosen: number;
  pick_rate: number | null;
}

interface ShopRow {
  category: string;
  name: string;
  offered: number;
  bought: number;
  buy_rate: number | null;
  avg_price: number | null;
}

interface FailRow {
  item_type: string;
  reason: string;
  count: number;
}

interface RewardRow {
  kind: string;
  name: string;
  offered: number;
  picked: number;
  pick_rate: number | null;
}

interface TreasureNodeRow {
  relic: string;
  offered: number;
  opened: number;
  skipped: number;
}

const NODE_COLUMNS: SortableColumn<NodeRow>[] = [
  textColumn<NodeRow>('node_type', 'ノードの種類'),
  numberColumn<NodeRow>('offered', '選べた'),
  numberColumn<NodeRow>('chosen', '選んだ'),
  rateColumn<NodeRow>('pick_rate', '選んだ割合'),
];

const SHOP_COLUMNS: SortableColumn<ShopRow>[] = [
  textColumn<ShopRow>('category', '種類'),
  textColumn<ShopRow>('name', '品物'),
  numberColumn<ShopRow>('offered', '並んだ'),
  numberColumn<ShopRow>('bought', '買われた'),
  rateColumn<ShopRow>('buy_rate', '買われた割合'),
  avgColumn<ShopRow>('avg_price', '平均の価格 (割引後)'),
];

const FAIL_COLUMNS: SortableColumn<FailRow>[] = [
  textColumn<FailRow>('item_type', '品物の種類'),
  textColumn<FailRow>('reason', '理由'),
  numberColumn<FailRow>('count', '回数'),
];

const REWARD_COLUMNS: SortableColumn<RewardRow>[] = [
  textColumn<RewardRow>('kind', '種類'),
  textColumn<RewardRow>('name', '候補'),
  numberColumn<RewardRow>('offered', '候補に出た'),
  numberColumn<RewardRow>('picked', '選ばれた'),
  rateColumn<RewardRow>('pick_rate', '選ばれた割合'),
];

const TREASURE_NODE_COLUMNS: SortableColumn<TreasureNodeRow>[] = [
  textColumn<TreasureNodeRow>('relic', '中のレリック'),
  numberColumn<TreasureNodeRow>('offered', '出会った'),
  numberColumn<TreasureNodeRow>('opened', '開けた'),
  numberColumn<TreasureNodeRow>('skipped', '開けずに進んだ'),
];

// ノードの ID は Layer3_1_Battle のように末尾がノードの種類
const nodeTypeSql = (column: string) => `split_part(${column}, '_', 3)`;
// カードは Olive(Seed) のように成長段階が付くので外してまとめる
const withoutStageSql = (column: string) => `regexp_replace(${column}, '\\(.*\\)$', '')`;

const nodeSql = (from: string, where: string) => `
  WITH ev AS (
    SELECT ${payloadText('stageId')} AS chosen, ${payloadText('available')} AS available
    FROM ${from}
    ${whereEvents(where, ['NodeSelected'])}
  ),
  offered AS (
    SELECT ${nodeTypeSql('node')} AS node_type, COUNT(*)::INTEGER AS offered
    FROM (SELECT unnest(string_split(available, ';')) AS node FROM ev) GROUP BY 1
  ),
  chosen AS (
    SELECT ${nodeTypeSql('chosen')} AS node_type, COUNT(*)::INTEGER AS chosen FROM ev GROUP BY 1
  )
  SELECT o.node_type, o.offered, COALESCE(c.chosen, 0)::INTEGER AS chosen,
    COALESCE(c.chosen, 0) / o.offered AS pick_rate
  FROM offered o LEFT JOIN chosen c USING (node_type)`;

// 品揃えを書く前のログの購入まで数えると割合が 100% を超えるので、品揃えを書いているランの購入だけを数える
const shopSql = (from: string, where: string) => `
  WITH opened AS (
    SELECT run_id, ${payloadText('cards')} AS cards, ${payloadText('relics')} AS relics,
      ${payloadText('items')} AS items, ${payloadText('bookCovers')} AS book_covers
    FROM ${from}
    ${whereEvents(where, ['ShopOpened'])}
  ),
  listed AS (
    SELECT category, split_part(entry, '@', 1) AS name, TRY_CAST(split_part(entry, '@', 2) AS DOUBLE) AS price
    FROM (
      SELECT 'Card' AS category, unnest(string_split(cards, ';')) AS entry FROM opened
      UNION ALL SELECT 'Relic', unnest(string_split(relics, ';')) FROM opened
      UNION ALL SELECT 'Item', unnest(string_split(items, ';')) FROM opened
      UNION ALL SELECT 'BookCover', unnest(string_split(book_covers, ';')) FROM opened
    ) WHERE entry <> ''
  ),
  offered AS (
    SELECT category, ${withoutStageSql('name')} AS name, COUNT(*)::INTEGER AS offered, AVG(price) AS avg_price
    FROM listed GROUP BY 1, 2
  ),
  bought AS (
    SELECT ${payloadText('itemType')} AS category, ${withoutStageSql(payloadText('itemName'))} AS name, COUNT(*)::INTEGER AS bought
    FROM ${from}
    ${whereEvents(where, ['ShopBuy'])} AND run_id IN (SELECT run_id FROM opened)
    GROUP BY 1, 2
  )
  SELECT o.category, o.name, o.offered, COALESCE(b.bought, 0)::INTEGER AS bought,
    COALESCE(b.bought, 0) / o.offered AS buy_rate, o.avg_price
  FROM offered o LEFT JOIN bought b USING (category, name)`;

const failSql = (from: string, where: string) => `
  SELECT ${payloadText('itemType')} AS item_type, ${payloadText('reason')} AS reason, COUNT(*)::INTEGER AS count
  FROM ${from}
  ${whereEvents(where, ['ShopBuyFailed'])}
  GROUP BY 1, 2`;

// 候補を書く前のログの選択は数えない (候補を書いているランの選択だけ)
const rewardSql = (from: string, where: string) => `
  WITH ev AS (
    SELECT run_id, event_type, ${payloadText('cards')} AS cards, ${payloadText('relic')} AS relic,
      ${payloadText('type')} AS type, ${payloadText('selected')} AS selected
    FROM ${from}
    ${whereEvents(where, ['RewardOffered', 'RewardSelected'])}
  ),
  offered AS (
    SELECT kind, ${withoutStageSql('entry')} AS name, COUNT(*)::INTEGER AS offered FROM (
      SELECT 'Card' AS kind, unnest(string_split(cards, ';')) AS entry FROM ev WHERE event_type = 'RewardOffered'
      UNION ALL SELECT 'Relic', relic FROM ev WHERE event_type = 'RewardOffered' AND relic IS NOT NULL AND relic <> 'None'
    ) WHERE entry <> '' GROUP BY 1, 2
  ),
  picked AS (
    SELECT type AS kind, ${withoutStageSql('selected')} AS name, COUNT(*)::INTEGER AS picked
    FROM ev WHERE event_type = 'RewardSelected'
      AND run_id IN (SELECT run_id FROM ev WHERE event_type = 'RewardOffered')
    GROUP BY 1, 2
  )
  SELECT o.kind, o.name, o.offered, COALESCE(p.picked, 0)::INTEGER AS picked,
    COALESCE(p.picked, 0) / o.offered AS pick_rate
  FROM offered o LEFT JOIN picked p USING (kind, name)`;

const treasureNodeSql = (from: string, where: string) => `
  SELECT ${payloadText('relic')} AS relic,
    COUNT(*) FILTER (WHERE event_type = 'TreasureNodeOffered')::INTEGER AS offered,
    COUNT(*) FILTER (WHERE event_type = 'TreasureNodeOpened')::INTEGER AS opened,
    COUNT(*) FILTER (WHERE event_type = 'TreasureNodeSkipped')::INTEGER AS skipped
  FROM ${from}
  ${whereEvents(where, ['TreasureNodeOffered', 'TreasureNodeOpened', 'TreasureNodeSkipped'])}
  GROUP BY 1`;

export function NodesPage() {
  const search = useSearch({ from: '/nodes' });
  return (
    <Stack gap="xl">
      <Stack gap="xs">
        <Title order={2}>ノードの分析</Title>
        <Text c="dimmed" size="sm">
          ワールドマップでどのノードを選んだか、ショップ・戦闘の報酬・宝箱ノードで何が出て何を選んだかを集計する。
          カードは成長段階を外してまとめる。
        </Text>
        <FilterBar filter={search} navigateTo={{ to: '/nodes' }} />
      </Stack>
      <EventAggregateTable
        title="ノードの選択"
        description="ノードを選んだときに選べたノード (NodeSelected の available) のうち、その種類を選んだ割合"
        queryKey="nodes-selection"
        buildSql={nodeSql}
        columns={NODE_COLUMNS}
        rowKey={(r) => r.node_type}
        defaultSort={[{ key: 'offered', direction: 'desc' }]}
        filter={search}
      />
      <EventAggregateTable
        title="ショップの品物"
        description="店を開いたときに並んだ品物 (ShopOpened) と、そのうち買われた回数 (ShopBuy)"
        queryKey="nodes-shop"
        buildSql={shopSql}
        columns={SHOP_COLUMNS}
        rowKey={(r) => `${r.category}|${r.name}`}
        defaultSort={[{ key: 'offered', direction: 'desc' }]}
        filter={search}
      />
      <EventAggregateTable
        title="ショップで買えなかった理由"
        queryKey="nodes-shop-failed"
        buildSql={failSql}
        columns={FAIL_COLUMNS}
        rowKey={(r) => `${r.item_type}|${r.reason}`}
        defaultSort={[{ key: 'count', direction: 'desc' }]}
        filter={search}
      />
      <EventAggregateTable
        title="戦闘の報酬"
        description="戦闘ごとの候補 (RewardOffered) と、そのうち選ばれた回数 (RewardSelected)。報酬画面を開かずに進んだ戦闘の候補も数える"
        queryKey="nodes-reward"
        buildSql={rewardSql}
        columns={REWARD_COLUMNS}
        rowKey={(r) => `${r.kind}|${r.name}`}
        defaultSort={[{ key: 'offered', direction: 'desc' }]}
        filter={search}
      />
      <EventAggregateTable
        title="宝箱ノード"
        queryKey="nodes-treasure"
        buildSql={treasureNodeSql}
        columns={TREASURE_NODE_COLUMNS}
        rowKey={(r) => r.relic}
        defaultSort={[{ key: 'offered', direction: 'desc' }]}
        filter={search}
      />
    </Stack>
  );
}
