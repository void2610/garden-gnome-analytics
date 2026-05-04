import {
  Badge,
  Card,
  Group,
  Loader,
  ScrollArea,
  Stack,
  Table,
  Tabs,
  Text,
  Title,
} from '@mantine/core';
import { LineChart } from '@mantine/charts';
import { useQuery } from '@tanstack/react-query';
import { useParams } from '@tanstack/react-router';
import { useManifest } from '../hooks/useManifest';
import { query } from '../lib/duckdb/query';
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

export function RunDetailPage() {
  const { runId } = useParams({ from: '/runs/$runId' });
  const { data: manifest } = useManifest();

  const { data: summary } = useQuery({
    queryKey: ['run-summary', runId, manifest?.generatedAt],
    enabled: !!manifest,
    queryFn: async () => {
      if (!manifest) return null;
      const sql = `
        SELECT * FROM ${runsFrom(manifest.datasets)}
        WHERE run_id = '${runId.replace(/'/g, "''")}'
        LIMIT 1
      `;
      const [row] = await query<RunSummary>(sql);
      return row ?? null;
    },
  });

  const { data: events } = useQuery({
    queryKey: ['run-events', runId, manifest?.generatedAt],
    enabled: !!manifest,
    queryFn: async () => {
      if (!manifest) return [];
      const sql = `
        SELECT seq, timestamp, event_type, payload
        FROM ${eventsFrom(manifest.datasets)}
        WHERE run_id = '${runId.replace(/'/g, "''")}'
        ORDER BY seq
      `;
      return await query<EventRow>(sql);
    },
  });

  const { data: errors } = useQuery({
    queryKey: ['run-errors', runId, manifest?.generatedAt],
    enabled: !!manifest,
    queryFn: async () => {
      if (!manifest) return [];
      const sql = `
        SELECT timestamp, level, message, stack_trace
        FROM ${errorsFrom(manifest.datasets)}
        WHERE run_id = '${runId.replace(/'/g, "''")}'
        ORDER BY timestamp
      `;
      return await query<ErrorRow>(sql);
    },
  });

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
        <Badge color={summary.outcome === 'win' ? 'green' : summary.outcome === 'loss' ? 'red' : 'gray'} size="lg">
          {summary.outcome}
        </Badge>
      </Group>

      <Card withBorder padding="md">
        <Group gap="xl">
          <Info label="開始" value={summary.started_at ? new Date(summary.started_at).toLocaleString('ja-JP') : '-'} />
          <Info label="終了" value={summary.ended_at ? new Date(summary.ended_at).toLocaleString('ja-JP') : '-'} />
          <Info label="長さ (秒)" value={summary.duration_sec != null ? Math.round(summary.duration_sec).toString() : '-'} />
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
          <ScrollArea h={500}>
            <Table withRowBorders={false} striped fz="xs">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>seq</Table.Th>
                  <Table.Th>時刻</Table.Th>
                  <Table.Th>event</Table.Th>
                  <Table.Th>payload</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {(events ?? []).slice(0, 1000).map((e) => (
                  <Table.Tr key={e.seq}>
                    <Table.Td>{e.seq}</Table.Td>
                    <Table.Td>
                      {new Date(e.timestamp).toLocaleTimeString('ja-JP', { hour12: false })}
                    </Table.Td>
                    <Table.Td>
                      <Badge variant="light">{e.event_type}</Badge>
                    </Table.Td>
                    <Table.Td style={{ fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                      {e.payload}
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </ScrollArea>
          {(events ?? []).length > 1000 && (
            <Text size="xs" c="dimmed" mt="xs">
              先頭 1000 件のみ表示 (全 {(events ?? []).length} 件)
            </Text>
          )}
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
                    <Badge color={e.level === 'Exception' ? 'red' : 'orange'}>
                      {e.level}
                    </Badge>
                    <Text size="sm" c="dimmed">
                      {new Date(e.timestamp).toLocaleString('ja-JP')}
                    </Text>
                  </Group>
                  <Text mt="xs">{e.message}</Text>
                  {e.stack_trace && (
                    <Text component="pre" mt="xs" size="xs" c="dimmed" style={{ whiteSpace: 'pre-wrap' }}>
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
      <Text size="xs" c="dimmed">{label}</Text>
      <Text fw={600}>{value}</Text>
    </Stack>
  );
}
