import { Card, Group, Loader, MultiSelect, SimpleGrid, Stack, Text, Title } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useManifest } from '../hooks/useManifest';
import { query } from '../lib/duckdb/query';
import { runsFrom } from '../queries/runsParquet';

interface ComparisonRow {
  event_slug: string;
  device_slug: string;
  total_runs: number;
  win_rate: number | null;
  median_duration_sec: number | null;
  avg_stage: number | null;
}

export function ComparePage() {
  const { data: manifest } = useManifest();
  const [selected, setSelected] = useState<string[]>([]);

  const options =
    manifest?.datasets.map((d) => ({
      value: `${d.eventSlug}__${d.deviceSlug}`,
      label: `${d.meta.event} / ${d.meta.device}`,
    })) ?? [];

  const datasets = (manifest?.datasets ?? []).filter((d) =>
    selected.includes(`${d.eventSlug}__${d.deviceSlug}`),
  );

  const { data: rows, isLoading } = useQuery({
    queryKey: ['compare', selected.join(','), manifest?.generatedAt],
    enabled: !!manifest && datasets.length > 0,
    queryFn: async () => {
      if (!manifest || datasets.length === 0) return [];
      const sql = `
        SELECT
          event_slug,
          device_slug,
          COUNT(*)::INTEGER AS total_runs,
          SUM(CASE WHEN outcome='win' THEN 1 ELSE 0 END)::DOUBLE / NULLIF(COUNT(*),0) AS win_rate,
          MEDIAN(duration_sec) AS median_duration_sec,
          AVG(stage_count) AS avg_stage
        FROM ${runsFrom(datasets)}
        GROUP BY 1, 2
      `;
      return await query<ComparisonRow>(sql);
    },
  });

  return (
    <Stack>
      <Title order={2}>比較ビュー</Title>
      <Text c="dimmed">複数データセットを並べて比較</Text>
      <MultiSelect
        label="対象データセット (最大 4)"
        data={options}
        value={selected}
        onChange={(v) => setSelected(v.slice(0, 4))}
        searchable
        clearable
      />
      {isLoading && <Loader />}
      <SimpleGrid cols={{ base: 1, sm: 2, lg: Math.max(1, selected.length) }}>
        {(rows ?? []).map((r) => (
          <Card key={`${r.event_slug}-${r.device_slug}`} withBorder padding="md">
            <Title order={4}>
              {r.event_slug} / {r.device_slug}
            </Title>
            <Group mt="sm" gap="xl">
              <Stat label="ラン数" value={r.total_runs.toString()} />
              <Stat
                label="勝率"
                value={r.win_rate != null ? `${(r.win_rate * 100).toFixed(1)}%` : '-'}
              />
              <Stat
                label="中央時間 (分)"
                value={
                  r.median_duration_sec != null ? (r.median_duration_sec / 60).toFixed(1) : '-'
                }
              />
              <Stat
                label="平均ステージ"
                value={r.avg_stage != null ? r.avg_stage.toFixed(1) : '-'}
              />
            </Group>
          </Card>
        ))}
      </SimpleGrid>
    </Stack>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Stack gap={0}>
      <Text size="xs" c="dimmed">
        {label}
      </Text>
      <Text fw={600}>{value}</Text>
    </Stack>
  );
}
