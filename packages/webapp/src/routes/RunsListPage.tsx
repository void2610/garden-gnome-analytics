import {
  Badge,
  Card,
  Loader,
  Stack,
  Table,
  Text,
  Title,
} from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearch } from '@tanstack/react-router';
import { FilterBar } from '../components/FilterBar';
import { useManifest } from '../hooks/useManifest';
import { buildWhereRuns } from '../lib/filter';
import { query } from '../lib/duckdb/query';
import { runsFrom } from '../queries/runsParquet';

interface RunRow {
  run_id: string;
  event_slug: string;
  device_slug: string;
  started_at: string | null;
  duration_sec: number | null;
  stage_count: number;
  outcome: string;
  final_hp: number | null;
  max_hp: number | null;
  final_deck_size: number | null;
}

export function RunsListPage() {
  const search = useSearch({ from: '/runs' });
  const { data: manifest } = useManifest();
  const filterKey = JSON.stringify(search);

  const { data: rows, isLoading } = useQuery({
    queryKey: ['runs-list', filterKey, manifest?.generatedAt],
    enabled: !!manifest && manifest.datasets.length > 0,
    queryFn: async () => {
      if (!manifest) return [];
      const where = buildWhereRuns(search);
      const sql = `
        SELECT
          run_id, event_slug, device_slug, started_at, duration_sec,
          stage_count, outcome, final_hp, max_hp, final_deck_size
        FROM ${runsFrom(manifest.datasets)}
        ${where}
        ORDER BY started_at DESC
        LIMIT 500
      `;
      return await query<RunRow>(sql);
    },
  });

  return (
    <Stack>
      <Title order={2}>ラン一覧</Title>
      <FilterBar filter={search} navigateTo={{ to: '/runs' }} />
      <Text c="dimmed" size="sm">
        {rows?.length ?? 0} 件 (最大 500 件)
      </Text>
      {isLoading ? (
        <Loader />
      ) : (
        <Card withBorder p="xs" style={{ overflowX: 'auto' }}>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>開始時刻</Table.Th>
                <Table.Th>機器</Table.Th>
                <Table.Th>長さ (秒)</Table.Th>
                <Table.Th>ステージ</Table.Th>
                <Table.Th>勝敗</Table.Th>
                <Table.Th>HP</Table.Th>
                <Table.Th>デッキサイズ</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {(rows ?? []).map((r) => (
                <Table.Tr key={r.run_id}>
                  <Table.Td>
                    <Link
                      to="/runs/$runId"
                      params={{ runId: r.run_id }}
                      style={{ textDecoration: 'none' }}
                    >
                      {r.started_at
                        ? new Date(r.started_at).toLocaleString('ja-JP')
                        : '-'}
                    </Link>
                  </Table.Td>
                  <Table.Td>{r.device_slug}</Table.Td>
                  <Table.Td>
                    {r.duration_sec != null
                      ? Math.round(r.duration_sec).toLocaleString('ja-JP')
                      : '-'}
                  </Table.Td>
                  <Table.Td>{r.stage_count}</Table.Td>
                  <Table.Td>
                    <Badge color={outcomeColor(r.outcome)} variant="light">
                      {r.outcome}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    {r.final_hp ?? '-'} / {r.max_hp ?? '-'}
                  </Table.Td>
                  <Table.Td>{r.final_deck_size ?? '-'}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Card>
      )}
    </Stack>
  );
}

function outcomeColor(outcome: string): string {
  switch (outcome) {
    case 'win':
      return 'green';
    case 'loss':
      return 'red';
    default:
      return 'gray';
  }
}
