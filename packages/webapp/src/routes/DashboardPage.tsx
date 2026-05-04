import {
  Card,
  Group,
  Loader,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { BarChart, LineChart } from '@mantine/charts';
import { useQuery } from '@tanstack/react-query';
import { useSearch } from '@tanstack/react-router';
import { FilterBar } from '../components/FilterBar';
import { useManifest } from '../hooks/useManifest';
import { buildWhereRuns } from '../lib/filter';
import { query } from '../lib/duckdb/query';
import { eventsFrom, runsFrom } from '../queries/runsParquet';

export function DashboardPage() {
  const search = useSearch({ from: '/dashboard' });
  const { data: manifest } = useManifest();

  const filterKey = JSON.stringify(search);
  const { data: kpi } = useQuery({
    queryKey: ['dashboard-kpi', filterKey, manifest?.generatedAt],
    enabled: !!manifest && manifest.datasets.length > 0,
    queryFn: async () => {
      if (!manifest) return null;
      const where = buildWhereRuns(search);
      const sql = `
        SELECT
          COUNT(*)::INTEGER AS total_runs,
          AVG(duration_sec) AS avg_duration_sec,
          AVG(stage_count) AS avg_stage,
          SUM(CASE WHEN outcome = 'win' THEN 1 ELSE 0 END)::DOUBLE / NULLIF(COUNT(*),0) AS win_rate,
          MEDIAN(duration_sec) AS median_duration_sec
        FROM ${runsFrom(manifest.datasets)}
        ${where}
      `;
      const [row] = await query<{
        total_runs: number;
        avg_duration_sec: number | null;
        avg_stage: number | null;
        win_rate: number | null;
        median_duration_sec: number | null;
      }>(sql);
      return row ?? null;
    },
  });

  const { data: byHour } = useQuery({
    queryKey: ['dashboard-by-hour', filterKey, manifest?.generatedAt],
    enabled: !!manifest && manifest.datasets.length > 0,
    queryFn: async () => {
      if (!manifest) return [];
      const where = buildWhereRuns(search);
      const sql = `
        SELECT EXTRACT(HOUR FROM started_at)::INTEGER AS hour, COUNT(*)::INTEGER AS plays
        FROM ${runsFrom(manifest.datasets)}
        ${where}
        GROUP BY 1 ORDER BY 1
      `;
      return await query<{ hour: number; plays: number }>(sql);
    },
  });

  const { data: byDay } = useQuery({
    queryKey: ['dashboard-by-day', filterKey, manifest?.generatedAt],
    enabled: !!manifest && manifest.datasets.length > 0,
    queryFn: async () => {
      if (!manifest) return [];
      const where = buildWhereRuns(search);
      const sql = `
        SELECT date_trunc('day', started_at)::DATE AS day, COUNT(*)::INTEGER AS plays
        FROM ${runsFrom(manifest.datasets)}
        ${where}
        GROUP BY 1 ORDER BY 1
      `;
      return await query<{ day: string; plays: number }>(sql);
    },
  });

  // events.parquet の存在確認のためのおまけクエリ（チャートの空表示回避）
  useQuery({
    queryKey: ['events-warmup', manifest?.generatedAt],
    enabled: !!manifest && manifest.datasets.length > 0,
    queryFn: async () => {
      if (!manifest) return null;
      await query(`SELECT COUNT(*) AS c FROM ${eventsFrom(manifest.datasets)}`);
      return null;
    },
  });

  if (!manifest) return <Loader />;

  const winPct = kpi?.win_rate != null ? `${(kpi.win_rate * 100).toFixed(1)}%` : '-';
  const medianMin =
    kpi?.median_duration_sec != null
      ? (kpi.median_duration_sec / 60).toFixed(1)
      : '-';
  const avgStage = kpi?.avg_stage != null ? kpi.avg_stage.toFixed(1) : '-';

  return (
    <Stack>
      <Title order={2}>ダッシュボード</Title>
      <FilterBar filter={search} navigateTo={{ to: '/dashboard' }} />
      <SimpleGrid cols={{ base: 2, sm: 4 }}>
        <Kpi label="総ラン数" value={kpi?.total_runs ?? '-'} />
        <Kpi label="中央プレイ時間 (分)" value={medianMin} />
        <Kpi label="平均到達ステージ" value={avgStage} />
        <Kpi label="勝率" value={winPct} />
      </SimpleGrid>

      <Card withBorder padding="md">
        <Title order={4}>時間帯別プレイ数</Title>
        <BarChart
          h={240}
          mt="md"
          data={byHour ?? []}
          dataKey="hour"
          series={[{ name: 'plays', color: 'primary.5' }]}
          tickLine="x"
        />
      </Card>

      <Card withBorder padding="md">
        <Title order={4}>日別プレイ数</Title>
        <LineChart
          h={240}
          mt="md"
          data={(byDay ?? []).map((r) => ({ ...r, day: String(r.day) }))}
          dataKey="day"
          series={[{ name: 'plays', color: 'primary.5' }]}
          curveType="linear"
        />
      </Card>
    </Stack>
  );
}

function Kpi({ label, value }: { label: string; value: number | string }) {
  return (
    <Card withBorder padding="md">
      <Group gap="xs" align="baseline">
        <Text size="xs" c="dimmed">
          {label}
        </Text>
      </Group>
      <Title order={3}>{typeof value === 'number' ? value.toLocaleString('ja-JP') : value}</Title>
    </Card>
  );
}
