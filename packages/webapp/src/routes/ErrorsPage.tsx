import { Badge, Card, Group, Loader, Stack, Table, Text, Title } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearch } from '@tanstack/react-router';
import { FilterBar } from '../components/FilterBar';
import { useManifest } from '../hooks/useManifest';
import { buildWhere } from '../lib/filter';
import { query } from '../lib/duckdb/query';
import { errorsFrom } from '../queries/runsParquet';

interface ErrorRow {
  timestamp: string;
  level: string;
  message: string;
  run_id: string | null;
  count: number;
}

export function ErrorsPage() {
  const search = useSearch({ from: '/errors' });
  const { data: manifest } = useManifest();
  const filterKey = JSON.stringify(search);

  const { data: rows, isLoading } = useQuery({
    queryKey: ['errors-list', filterKey, manifest?.generatedAt],
    enabled: !!manifest && manifest.datasets.length > 0,
    queryFn: async () => {
      if (!manifest) return [];
      const where = buildWhere(search);
      const sql = `
        SELECT
          ANY_VALUE(timestamp) AS timestamp,
          level,
          message,
          ANY_VALUE(run_id) AS run_id,
          COUNT(*)::INTEGER AS count
        FROM ${errorsFrom(manifest.datasets)}
        ${where}
        GROUP BY level, message
        ORDER BY count DESC
        LIMIT 200
      `;
      return await query<ErrorRow>(sql);
    },
  });

  return (
    <Stack>
      <Title order={2}>エラー一覧</Title>
      <FilterBar filter={search} navigateTo={{ to: '/errors' }} />
      {isLoading ? (
        <Loader />
      ) : (
        <Card withBorder p="xs" style={{ overflowX: 'auto' }}>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>level</Table.Th>
                <Table.Th>件数</Table.Th>
                <Table.Th>メッセージ</Table.Th>
                <Table.Th>例: 関連 run</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {(rows ?? []).map((r, i) => (
                <Table.Tr key={`${r.level}-${i}`}>
                  <Table.Td>
                    <Badge color={r.level === 'Exception' ? 'red' : 'orange'}>
                      {r.level}
                    </Badge>
                  </Table.Td>
                  <Table.Td>{r.count}</Table.Td>
                  <Table.Td style={{ maxWidth: 480, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {r.message}
                  </Table.Td>
                  <Table.Td>
                    {r.run_id ? (
                      <Link to="/runs/$runId" params={{ runId: r.run_id }}>
                        {r.run_id}
                      </Link>
                    ) : (
                      <Text c="dimmed">-</Text>
                    )}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Card>
      )}
      {rows && rows.length === 0 && <Text c="dimmed">エラーなし</Text>}
    </Stack>
  );
}
