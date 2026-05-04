import { Card, Group, Loader, SimpleGrid, Stack, Text, Title } from '@mantine/core';
import { Link } from '@tanstack/react-router';
import { useManifest } from '../hooks/useManifest';

export function DatasetsPage() {
  const { data: manifest, isLoading, error } = useManifest();

  if (isLoading) return <Loader />;
  if (error)
    return (
      <Stack>
        <Title order={3}>データセット一覧の取得に失敗しました</Title>
        <Text c="red">{(error as Error).message}</Text>
      </Stack>
    );
  if (!manifest) return null;

  return (
    <Stack>
      <Title order={2}>データセット</Title>
      <Text c="dimmed">
        生成日時: {new Date(manifest.generatedAt).toLocaleString('ja-JP')} /{' '}
        {manifest.datasets.length} 件
      </Text>
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
        {manifest.datasets.map((d) => {
          const slug = `${d.eventSlug}__${d.deviceSlug}`;
          return (
            <Card
              key={slug}
              component={Link}
              // biome-ignore lint/suspicious/noExplicitAny: 動的 params の型推論が router 循環で効かない
              {...({ to: '/datasets/$slug', params: { slug } } as any)}
              shadow="sm"
              padding="md"
              withBorder
              style={{ textDecoration: 'none' }}
            >
              <Title order={4}>{d.meta.event}</Title>
              <Text size="sm" c="dimmed">
                {d.meta.device} / {d.meta.game_version ?? '-'}
              </Text>
              <Group mt="sm" gap="md">
                <Stat label="ラン" value={d.runCount} />
                <Stat label="イベント" value={d.eventCount} />
                <Stat label="エラー" value={d.errorCount} />
              </Group>
              {d.period.from && d.period.to && (
                <Text size="xs" c="dimmed" mt="xs">
                  {new Date(d.period.from).toLocaleDateString('ja-JP')} 〜{' '}
                  {new Date(d.period.to).toLocaleDateString('ja-JP')}
                </Text>
              )}
            </Card>
          );
        })}
      </SimpleGrid>
    </Stack>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Stack gap={0}>
      <Text size="xs" c="dimmed">
        {label}
      </Text>
      <Text fw={700}>{value.toLocaleString('ja-JP')}</Text>
    </Stack>
  );
}
