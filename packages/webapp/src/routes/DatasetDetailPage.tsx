import { Card, Group, Loader, SimpleGrid, Stack, Text, Title } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { useParams } from '@tanstack/react-router';
import { query } from '../lib/duckdb/query';
import { eventsParquetUrl, runsParquetUrl } from '../lib/duckdb/paths';
import { useManifest } from '../hooks/useManifest';

export function DatasetDetailPage() {
  const params = useParams({ from: '/datasets/$slug' });
  const slug = params.slug;
  const { data: manifest } = useManifest();
  const dataset = manifest?.datasets.find(
    (d) => `${d.eventSlug}__${d.deviceSlug}` === slug,
  );

  const { data: counts, isLoading } = useQuery({
    queryKey: ['dataset-count', slug],
    enabled: !!dataset,
    queryFn: async () => {
      if (!dataset) return null;
      const eUrl = eventsParquetUrl(dataset.eventSlug, dataset.deviceSlug);
      const rUrl = runsParquetUrl(dataset.eventSlug, dataset.deviceSlug);
      const [eventCount] = await query<{ c: number }>(
        `SELECT COUNT(*)::INTEGER c FROM read_parquet('${eUrl}')`,
      );
      const [runCount] = await query<{ c: number }>(
        `SELECT COUNT(*)::INTEGER c FROM read_parquet('${rUrl}')`,
      );
      return { events: eventCount?.c ?? 0, runs: runCount?.c ?? 0 };
    },
  });

  if (!dataset) return <Text>データセット {slug} は manifest に存在しません</Text>;

  return (
    <Stack>
      <Title order={2}>{dataset.meta.event}</Title>
      <Text c="dimmed">
        {dataset.meta.device} / {dataset.meta.game_version ?? '-'} /{' '}
        {dataset.meta.venue ?? ''}
      </Text>
      {dataset.meta.notes && <Text size="sm">{dataset.meta.notes}</Text>}

      <SimpleGrid cols={{ base: 1, sm: 3 }} mt="md">
        <Card withBorder padding="md">
          <Text size="sm" c="dimmed">ラン数</Text>
          {isLoading ? <Loader size="sm" /> : <Title order={3}>{counts?.runs}</Title>}
        </Card>
        <Card withBorder padding="md">
          <Text size="sm" c="dimmed">イベント数</Text>
          {isLoading ? <Loader size="sm" /> : <Title order={3}>{counts?.events}</Title>}
        </Card>
        <Card withBorder padding="md">
          <Text size="sm" c="dimmed">エラー数</Text>
          <Title order={3}>{dataset.errorCount}</Title>
        </Card>
      </SimpleGrid>

      <Group mt="md" align="flex-start">
        <Card withBorder padding="md" style={{ flex: 1 }}>
          <Text size="sm" c="dimmed">期間</Text>
          <Text>
            {dataset.period.from
              ? new Date(dataset.period.from).toLocaleString('ja-JP')
              : '-'}
            <br />
            {dataset.period.to
              ? new Date(dataset.period.to).toLocaleString('ja-JP')
              : '-'}
          </Text>
        </Card>
      </Group>
    </Stack>
  );
}
