// イベント詳細ページ。
// 同一イベント (eventSlug) に属する機器の概要と、機器ごとの選択カードを表示する。
import { Card, Group, Loader, SimpleGrid, Stack, Text, Title } from '@mantine/core';
import { Link, useParams } from '@tanstack/react-router';
import { useManifest } from '../hooks/useManifest';
import type { ManifestDataset } from '../lib/manifest';

export function EventDetailPage() {
  const { eventSlug } = useParams({ from: '/events/$eventSlug' });
  const { data: manifest, isLoading } = useManifest();

  if (isLoading) return <Loader />;
  if (!manifest) return null;

  const datasets = manifest.datasets.filter((d) => d.eventSlug === eventSlug);
  if (datasets.length === 0) {
    return <Text>イベント {eventSlug} に該当するデータセットがありません</Text>;
  }
  const head = datasets[0]!;
  const totals = aggregate(datasets);

  return (
    <Stack>
      <Title order={2}>{head.eventMeta?.name ?? head.meta.event}</Title>
      <Text c="dimmed">
        {[head.meta.event_date, head.meta.venue].filter(Boolean).join(' / ') || '-'}
      </Text>
      {head.eventMeta?.play_hours && (
        <Text size="sm" c="dimmed">
          開催時間: {head.eventMeta.play_hours.start}–{head.eventMeta.play_hours.end} (JST,
          範囲外のランは除外済み)
        </Text>
      )}
      {head.eventMeta?.description && (
        <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
          {head.eventMeta.description}
        </Text>
      )}
      <SimpleGrid cols={{ base: 1, sm: 4 }} mt="md">
        <Card withBorder padding="md">
          <Text size="sm" c="dimmed">
            機器数
          </Text>
          <Title order={3}>{datasets.length}</Title>
        </Card>
        <Card withBorder padding="md">
          <Text size="sm" c="dimmed">
            ラン数
          </Text>
          <Title order={3}>{totals.runCount.toLocaleString('ja-JP')}</Title>
        </Card>
        <Card withBorder padding="md">
          <Text size="sm" c="dimmed">
            イベント数
          </Text>
          <Title order={3}>{totals.eventCount.toLocaleString('ja-JP')}</Title>
        </Card>
        <Card withBorder padding="md">
          <Text size="sm" c="dimmed">
            エラー数
          </Text>
          <Title order={3}>{totals.errorCount.toLocaleString('ja-JP')}</Title>
        </Card>
      </SimpleGrid>

      {totals.periodFrom && totals.periodTo && (
        <Card withBorder padding="md">
          <Text size="sm" c="dimmed">
            期間
          </Text>
          <Text>
            {new Date(totals.periodFrom).toLocaleString('ja-JP')}
            <br />
            {new Date(totals.periodTo).toLocaleString('ja-JP')}
          </Text>
        </Card>
      )}

      <Title order={3} mt="md">
        機器を選択
      </Title>
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
        {datasets.map((d) => {
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
              <Title order={4}>{d.meta.device}</Title>
              <Text size="sm" c="dimmed">
                {d.meta.game_version ?? '-'}
              </Text>
              {d.meta.notes && (
                <Text size="xs" c="dimmed" mt={4}>
                  {d.meta.notes}
                </Text>
              )}
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

interface Aggregate {
  runCount: number;
  eventCount: number;
  errorCount: number;
  periodFrom: string | null;
  periodTo: string | null;
}

function aggregate(datasets: ManifestDataset[]): Aggregate {
  const acc: Aggregate = {
    runCount: 0,
    eventCount: 0,
    errorCount: 0,
    periodFrom: null,
    periodTo: null,
  };
  for (const d of datasets) {
    acc.runCount += d.runCount;
    acc.eventCount += d.eventCount;
    acc.errorCount += d.errorCount;
    if (d.period.from && (!acc.periodFrom || d.period.from < acc.periodFrom)) {
      acc.periodFrom = d.period.from;
    }
    if (d.period.to && (!acc.periodTo || d.period.to > acc.periodTo)) {
      acc.periodTo = d.period.to;
    }
  }
  return acc;
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
