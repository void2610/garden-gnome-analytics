import { Stack, Text, Title } from '@mantine/core';
import { useSearch } from '@tanstack/react-router';
import { EventAggregateTable } from '../components/EventAggregateTable';
import { FilterBar } from '../components/FilterBar';
import type { SortableColumn } from '../components/SortableTable';
import { avgColumn, numberColumn, rateColumn, textColumn } from '../lib/columns';
import { payloadText, whereEvents } from '../queries/enemies';

interface WinRow {
  node_type: string;
  reason: string;
  wins: number;
  avg_turns: number | null;
  avg_remain_hp: number | null;
}

interface CardRow {
  card: string;
  kind: string;
  plays: number;
  avg_targets: number | null;
  no_target_rate: number | null;
  blocked: number;
  cancelled: number;
  failed: number;
}

interface TurnRow {
  kind: string;
  reason: string;
  count: number;
}

interface SelectionRow {
  selection_type: string;
  card: string;
  count: number;
}

const BATTLE_END_JA: Record<string, string> = {
  Exit: '出口に着いた',
  AllEnemiesDefeated: '敵を全滅させた',
  Escape: '逃げた',
};

const WIN_COLUMNS: SortableColumn<WinRow>[] = [
  textColumn<WinRow>('node_type', 'ノードの種類'),
  textColumn<WinRow>('reason', '勝ち方', (r) => BATTLE_END_JA[r.reason] ?? r.reason),
  numberColumn<WinRow>('wins', '回数'),
  avgColumn<WinRow>('avg_turns', '平均ターン'),
  avgColumn<WinRow>('avg_remain_hp', '平均の残り HP'),
];

const CARD_COLUMNS: SortableColumn<CardRow>[] = [
  textColumn<CardRow>('card', 'カード'),
  textColumn<CardRow>('kind', '使い方'),
  numberColumn<CardRow>('plays', '使った回数'),
  avgColumn<CardRow>('avg_targets', '範囲内の対象の平均'),
  rateColumn<CardRow>('no_target_rate', '範囲内に対象なし'),
  numberColumn<CardRow>('blocked', '封印で使えず'),
  numberColumn<CardRow>('cancelled', '取りやめ'),
  numberColumn<CardRow>('failed', 'コスト不足'),
];

const TURN_COLUMNS: SortableColumn<TurnRow>[] = [
  textColumn<TurnRow>('kind', '種類'),
  textColumn<TurnRow>('reason', '理由'),
  numberColumn<TurnRow>('count', '回数'),
];

const SELECTION_COLUMNS: SortableColumn<SelectionRow>[] = [
  textColumn<SelectionRow>('selection_type', '選び方'),
  textColumn<SelectionRow>('card', '選んだカード'),
  numberColumn<SelectionRow>('count', '回数'),
];

// 勝ちの行にはノードの種類が無いので、同じランの直前の BattleStart の nodeType を引き継ぐ
const winSql = (from: string, where: string) => `
  WITH ev AS (
    SELECT run_id, event_slug, device_slug, seq, event_type,
      ${payloadText('nodeType')} AS direct_node_type,
      ${payloadText('reason')} AS reason,
      TRY_CAST(json_extract(payload, '$.turnCount') AS DOUBLE) AS turns,
      TRY_CAST(json_extract(payload, '$.remainHp') AS DOUBLE) AS remain_hp
    FROM ${from}
    ${whereEvents(where, ['BattleStart', 'BattleWin'])}
  ),
  filled AS (
    SELECT *, LAST_VALUE(direct_node_type IGNORE NULLS) OVER (
      PARTITION BY event_slug, device_slug, run_id ORDER BY seq ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) AS node_type
    FROM ev
  )
  SELECT COALESCE(node_type, '不明') AS node_type, COALESCE(reason, '不明') AS reason,
    COUNT(*)::INTEGER AS wins, AVG(turns) AS avg_turns, AVG(remain_hp) AS avg_remain_hp
  FROM filled WHERE event_type = 'BattleWin' GROUP BY 1, 2`;

const cardSql = (from: string, where: string) => `
  WITH ev AS (
    SELECT event_type, ${payloadText('cardName')} AS card, ${payloadText('kind')} AS kind, ${payloadText('targets')} AS targets
    FROM ${from}
    ${whereEvents(where, ['CardPlayed', 'CardBlocked', 'CardCancelled', 'CardPlayFailed'])}
  ),
  played AS (
    SELECT card, ANY_VALUE(kind) AS kind, COUNT(*)::INTEGER AS plays,
      AVG(CASE WHEN targets IS NULL THEN NULL WHEN targets = '' THEN 0 ELSE len(string_split(targets, ';')) END) AS avg_targets,
      AVG(CASE WHEN targets IS NULL THEN NULL WHEN targets = '' THEN 1 ELSE 0 END) AS no_target_rate
    FROM ev WHERE event_type = 'CardPlayed' GROUP BY 1
  ),
  others AS (
    SELECT card,
      COUNT(*) FILTER (WHERE event_type = 'CardBlocked')::INTEGER AS blocked,
      COUNT(*) FILTER (WHERE event_type = 'CardCancelled')::INTEGER AS cancelled,
      COUNT(*) FILTER (WHERE event_type = 'CardPlayFailed')::INTEGER AS failed
    FROM ev WHERE event_type <> 'CardPlayed' GROUP BY 1
  )
  SELECT COALESCE(p.card, o.card) AS card, COALESCE(p.kind, '') AS kind, COALESCE(p.plays, 0)::INTEGER AS plays,
    p.avg_targets, p.no_target_rate,
    COALESCE(o.blocked, 0)::INTEGER AS blocked, COALESCE(o.cancelled, 0)::INTEGER AS cancelled, COALESCE(o.failed, 0)::INTEGER AS failed
  FROM played p FULL OUTER JOIN others o USING (card)`;

const turnSql = (from: string, where: string) => `
  SELECT CASE event_type WHEN 'TurnSkipped' THEN '行動できなかった' ELSE '混乱した' END AS kind,
    COALESCE(${payloadText('reason')}, '') AS reason, COUNT(*)::INTEGER AS count
  FROM ${from}
  ${whereEvents(where, ['TurnSkipped', 'ConfusedTurn'])}
  GROUP BY 1, 2`;

const selectionSql = (from: string, where: string) => `
  SELECT ${payloadText('selectionType')} AS selection_type,
    COALESCE(${payloadText('cardName')}, '(選ばなかった)') AS card, COUNT(*)::INTEGER AS count
  FROM ${from}
  ${whereEvents(where, ['HandCardSelected', 'HandCardSelectionSkipped'])}
  GROUP BY 1, 2`;

export function BattlesPage() {
  const search = useSearch({ from: '/battles' });
  return (
    <Stack gap="xl">
      <Stack gap="xs">
        <Title order={2}>戦闘の分析</Title>
        <Text c="dimmed" size="sm">
          戦闘の勝ち方、カードの使い方
          (範囲内に入れた対象・封印・取りやめ)、プレイヤーが動けなかったターン、カード効果での手札の選び方を集計する。
        </Text>
        <FilterBar filter={search} navigateTo={{ to: '/battles' }} />
      </Stack>
      <EventAggregateTable
        title="勝ち方"
        queryKey="battles-wins"
        buildSql={winSql}
        columns={WIN_COLUMNS}
        rowKey={(r) => `${r.node_type}|${r.reason}`}
        defaultSort={[{ key: 'wins', direction: 'desc' }]}
        filter={search}
      />
      <EventAggregateTable
        title="カードの使い方"
        description="範囲内の対象は、効果の前に攻撃の範囲に入っていた敵と壊せる障害物 (CardPlayed の targets)"
        queryKey="battles-cards"
        buildSql={cardSql}
        columns={CARD_COLUMNS}
        rowKey={(r) => r.card}
        defaultSort={[{ key: 'plays', direction: 'desc' }]}
        filter={search}
      />
      <EventAggregateTable
        title="プレイヤーが動けなかったターン"
        queryKey="battles-turns"
        buildSql={turnSql}
        columns={TURN_COLUMNS}
        rowKey={(r) => `${r.kind}|${r.reason}`}
        defaultSort={[{ key: 'count', direction: 'desc' }]}
        filter={search}
      />
      <EventAggregateTable
        title="カード効果での手札の選択"
        queryKey="battles-hand-selection"
        buildSql={selectionSql}
        columns={SELECTION_COLUMNS}
        rowKey={(r) => `${r.selection_type}|${r.card}`}
        defaultSort={[{ key: 'count', direction: 'desc' }]}
        filter={search}
      />
    </Stack>
  );
}
