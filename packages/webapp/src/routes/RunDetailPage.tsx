import { Badge, Card, Group, Loader, ScrollArea, Stack, Tabs, Text, Title } from '@mantine/core';
import { LineChart } from '@mantine/charts';
import { useQuery } from '@tanstack/react-query';
import { useParams } from '@tanstack/react-router';
import { useMemo } from 'react';
import { QueryBar } from '../components/QueryBar';
import { type SortableColumn, type SortKey, SortableTable } from '../components/SortableTable';
import { useManifest } from '../hooks/useManifest';
import { useLocalTableQuery } from '../hooks/useTableQuery';
import { query } from '../lib/duckdb/query';
import { applyTableQuery } from '../lib/tableQuery';
import { errorsFrom, eventsFrom, runsFrom } from '../queries/runsParquet';

interface RunSummary {
  run_id: string;
  event_slug: string;
  device_slug: string;
  started_at: string | null;
  ended_at: string | null;
  duration_sec: number | null;
  outcome: string;
  stage_count: number;
  final_hp: number | null;
  max_hp: number | null;
  final_deck_size: number | null;
  game_version: string | null;
}

interface EventRow {
  seq: number;
  timestamp: string;
  event_type: string;
  payload: string;
}

interface ErrorRow {
  timestamp: string;
  level: string;
  message: string;
  stack_trace: string | null;
}

function parseSlug(slug: string): { eventSlug: string; deviceSlug: string; runId: string } | null {
  // `<event>__<device>__<run_id>` で分解。run_id 内に __ がある可能性は無いが念のため最後の split。
  const parts = slug.split('__');
  if (parts.length < 3) return null;
  // 末尾 2 つ以外は eventSlug 扱い (eventSlug にハイフンや英数字)
  const eventSlug = parts.slice(0, parts.length - 2).join('__');
  const deviceSlug = parts[parts.length - 2];
  const runId = parts[parts.length - 1];
  if (!eventSlug || !deviceSlug || !runId) return null;
  return { eventSlug, deviceSlug, runId };
}

function escapeSql(s: string): string {
  return s.replace(/'/g, "''");
}

const TIMELINE_DEFAULT_SORT: SortKey[] = [{ key: 'seq', direction: 'asc' }];

export function RunDetailPage() {
  const { slug } = useParams({ from: '/runs/$slug' });
  const parsed = parseSlug(slug);
  const { data: manifest } = useManifest();
  const timelineTQ = useLocalTableQuery();

  const whereCommon = parsed
    ? `WHERE event_slug = '${escapeSql(parsed.eventSlug)}'
        AND device_slug = '${escapeSql(parsed.deviceSlug)}'
        AND run_id = '${escapeSql(parsed.runId)}'`
    : 'WHERE FALSE';

  const { data: summary } = useQuery({
    queryKey: ['run-summary', slug, manifest?.generatedAt],
    enabled: !!manifest && !!parsed,
    queryFn: async () => {
      if (!manifest) return null;
      const sql = `
        SELECT * FROM ${runsFrom(manifest.datasets)}
        ${whereCommon}
        LIMIT 1
      `;
      const [row] = await query<RunSummary>(sql);
      return row ?? null;
    },
  });

  const { data: events } = useQuery({
    queryKey: ['run-events', slug, manifest?.generatedAt],
    enabled: !!manifest && !!parsed,
    queryFn: async () => {
      if (!manifest) return [];
      const sql = `
        SELECT seq, timestamp, event_type, payload
        FROM ${eventsFrom(manifest.datasets)}
        ${whereCommon}
        ORDER BY seq
      `;
      return await query<EventRow>(sql);
    },
  });

  const { data: errors } = useQuery({
    queryKey: ['run-errors', slug, manifest?.generatedAt],
    enabled: !!manifest && !!parsed,
    queryFn: async () => {
      if (!manifest) return [];
      const sql = `
        SELECT timestamp, level, message, stack_trace
        FROM ${errorsFrom(manifest.datasets)}
        ${whereCommon}
        ORDER BY timestamp
      `;
      return await query<ErrorRow>(sql);
    },
  });

  // event_type の選択肢は実データから動的に作る
  const eventTypeOptions = useMemo(() => {
    const set = new Set<string>();
    for (const e of events ?? []) {
      if (e.event_type) set.add(e.event_type);
    }
    return [...set].sort().map((v) => ({ value: v, label: v }));
  }, [events]);

  const timelineColumns: SortableColumn<EventRow>[] = useMemo(
    () => [
      {
        key: 'seq',
        label: 'seq',
        accessor: (r) => r.seq,
        numeric: true,
        align: 'right',
        filter: { kind: 'number' },
      },
      {
        key: 'timestamp',
        label: '時刻',
        accessor: (r) => r.timestamp,
        filter: { kind: 'date' },
        render: (r) => new Date(r.timestamp).toLocaleTimeString('ja-JP', { hour12: false }),
      },
      {
        key: 'event_type',
        label: 'event',
        accessor: (r) => r.event_type,
        filter: { kind: 'enum', enumOptions: eventTypeOptions },
        render: (r) => <Badge variant="light">{r.event_type}</Badge>,
      },
      {
        key: 'payload',
        label: 'payload',
        accessor: (r) => r.payload,
        filter: { kind: 'text' },
        render: (r) => (
          <span
            style={{
              fontFamily: 'monospace',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
              fontSize: 12,
            }}
          >
            {r.payload}
          </span>
        ),
      },
    ],
    [eventTypeOptions],
  );

  const visibleEvents = useMemo(() => {
    const filtered = applyTableQuery(events ?? [], timelineColumns, { tf: timelineTQ.query.tf });
    // 描画コスト対策: フィルタ後でも先頭 1000 件に制限
    return filtered.slice(0, 1000);
  }, [events, timelineColumns, timelineTQ.query.tf]);

  const totalFiltered = useMemo(() => {
    return applyTableQuery(events ?? [], timelineColumns, { tf: timelineTQ.query.tf }).length;
  }, [events, timelineColumns, timelineTQ.query.tf]);

  const hpSeries = (events ?? [])
    .map((e) => {
      try {
        const p = JSON.parse(e.payload) as Record<string, unknown>;
        const hp = typeof p.hp === 'number' ? p.hp : undefined;
        if (hp == null) return null;
        return { seq: e.seq, hp };
      } catch {
        return null;
      }
    })
    .filter((v): v is { seq: number; hp: number } => v !== null);

  if (!summary) return <Loader />;

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={2}>ラン詳細: {summary.run_id}</Title>
        <Badge
          color={summary.outcome === 'win' ? 'green' : summary.outcome === 'loss' ? 'red' : 'gray'}
          size="lg"
        >
          {summary.outcome}
        </Badge>
      </Group>

      <Card withBorder padding="md">
        <Group gap="xl">
          <Info
            label="開始"
            value={summary.started_at ? new Date(summary.started_at).toLocaleString('ja-JP') : '-'}
          />
          <Info
            label="終了"
            value={summary.ended_at ? new Date(summary.ended_at).toLocaleString('ja-JP') : '-'}
          />
          <Info
            label="長さ (秒)"
            value={summary.duration_sec != null ? Math.round(summary.duration_sec).toString() : '-'}
          />
          <Info label="ステージ数" value={String(summary.stage_count)} />
          <Info label="最終 HP" value={`${summary.final_hp ?? '-'} / ${summary.max_hp ?? '-'}`} />
          <Info label="デッキサイズ" value={String(summary.final_deck_size ?? '-')} />
          <Info label="バージョン" value={summary.game_version ?? '-'} />
        </Group>
      </Card>

      <Tabs defaultValue="timeline">
        <Tabs.List>
          <Tabs.Tab value="timeline">タイムライン ({(events ?? []).length})</Tabs.Tab>
          <Tabs.Tab value="hp">HP 推移</Tabs.Tab>
          <Tabs.Tab value="errors">エラー ({(errors ?? []).length})</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="timeline" pt="sm">
          <Stack gap="xs">
            <QueryBar
              columns={timelineColumns}
              query={timelineTQ.query}
              onChange={timelineTQ.setQuery}
            />
            <Text size="xs" c="dimmed">
              {visibleEvents.length} / {totalFiltered} 件表示
              {totalFiltered > 1000 && ' (先頭 1000 件のみ)'}
            </Text>
            <ScrollArea h={500}>
              <SortableTable
                columns={timelineColumns}
                rows={visibleEvents}
                rowKey={(r) => String(r.seq)}
                sort={timelineTQ.query.ts ?? TIMELINE_DEFAULT_SORT}
                onSortChange={(s) => timelineTQ.setQuery({ ...timelineTQ.query, ts: s })}
              />
            </ScrollArea>
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="hp" pt="sm">
          {hpSeries.length === 0 ? (
            <Text c="dimmed">HP データなし</Text>
          ) : (
            <LineChart
              h={300}
              data={hpSeries}
              dataKey="seq"
              series={[{ name: 'hp', color: 'red.5' }]}
              curveType="linear"
            />
          )}
        </Tabs.Panel>

        <Tabs.Panel value="errors" pt="sm">
          {(errors ?? []).length === 0 ? (
            <Text c="dimmed">関連エラーなし</Text>
          ) : (
            <Stack>
              {(errors ?? []).map((e) => (
                <Card key={`${e.timestamp}-${e.level}`} withBorder padding="sm">
                  <Group>
                    <Badge color={e.level === 'Exception' ? 'red' : 'orange'}>{e.level}</Badge>
                    <Text size="sm" c="dimmed">
                      {new Date(e.timestamp).toLocaleString('ja-JP')}
                    </Text>
                  </Group>
                  <Text mt="xs">{e.message}</Text>
                  {e.stack_trace && (
                    <Text
                      component="pre"
                      mt="xs"
                      size="xs"
                      c="dimmed"
                      style={{ whiteSpace: 'pre-wrap' }}
                    >
                      {e.stack_trace}
                    </Text>
                  )}
                </Card>
              ))}
            </Stack>
          )}
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <Stack gap={0}>
      <Text size="xs" c="dimmed">
        {label}
      </Text>
      <Text fw={600}>{value}</Text>
    </Stack>
  );
}
