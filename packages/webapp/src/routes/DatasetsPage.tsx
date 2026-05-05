// データセット一覧 (イベント単位で集約)
// 機器ごとの内訳は /events/$eventSlug で表示する。
import { Card, Group, Loader, SimpleGrid, Stack, Text, Title } from '@mantine/core';
import { Link } from '@tanstack/react-router';
import { useManifest } from '../hooks/useManifest';
import type { ManifestDataset } from '../lib/manifest';

interface EventGroup {
  eventSlug: string;
  eventName: string;
  eventDate?: string;
  venue?: string;
  deviceCount: number;
  runCount: number;
  eventCount: number;
  errorCount: number;
  periodFrom: string | null;
  periodTo: string | null;
}

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

  const groups = groupByEvent(manifest.datasets);

  return (
    <Stack>
      <Title order={2}>データセット</Title>
      <Text c="dimmed">
        生成日時: {new Date(manifest.generatedAt).toLocaleString('ja-JP')} / {groups.length}{' '}
        イベント / {manifest.datasets.length} データセット
      </Text>
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
        {groups.map((g) => (
          <Card
            key={g.eventSlug}
            component={Link}
            // biome-ignore lint/suspicious/noExplicitAny: 動的 params の型推論が router 循環で効かない
            {...({ to: '/events/$eventSlug', params: { eventSlug: g.eventSlug } } as any)}
            shadow="sm"
            padding="md"
            withBorder
            style={{ textDecoration: 'none' }}
          >
            <Title order={4}>{g.eventName}</Title>
            <Text size="sm" c="dimmed">
              {[g.eventDate, g.venue].filter(Boolean).join(' / ') || '-'}
            </Text>
            <Group mt="sm" gap="md">
              <Stat label="機器" value={g.deviceCount} />
              <Stat label="ラン" value={g.runCount} />
              <Stat label="イベント" value={g.eventCount} />
              <Stat label="エラー" value={g.errorCount} />
            </Group>
            {g.periodFrom && g.periodTo && (
              <Text size="xs" c="dimmed" mt="xs">
                {new Date(g.periodFrom).toLocaleDateString('ja-JP')} 〜{' '}
                {new Date(g.periodTo).toLocaleDateString('ja-JP')}
              </Text>
            )}
          </Card>
        ))}
      </SimpleGrid>
    </Stack>
  );
}

function groupByEvent(datasets: ManifestDataset[]): EventGroup[] {
  const map = new Map<string, EventGroup>();
  for (const d of datasets) {
    const existing = map.get(d.eventSlug);
    if (existing) {
      existing.deviceCount += 1;
      existing.runCount += d.runCount;
      existing.eventCount += d.eventCount;
      existing.errorCount += d.errorCount;
      if (d.period.from && (!existing.periodFrom || d.period.from < existing.periodFrom)) {
        existing.periodFrom = d.period.from;
      }
      if (d.period.to && (!existing.periodTo || d.period.to > existing.periodTo)) {
        existing.periodTo = d.period.to;
      }
    } else {
      map.set(d.eventSlug, {
        eventSlug: d.eventSlug,
        eventName: d.eventMeta?.name ?? d.meta.event,
        eventDate: d.meta.event_date,
        venue: d.meta.venue,
        deviceCount: 1,
        runCount: d.runCount,
        eventCount: d.eventCount,
        errorCount: d.errorCount,
        periodFrom: d.period.from,
        periodTo: d.period.to,
      });
    }
  }
  // 期間の新しい順
  return Array.from(map.values()).sort((a, b) => {
    const at = a.periodFrom ?? '';
    const bt = b.periodFrom ?? '';
    return bt.localeCompare(at);
  });
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
