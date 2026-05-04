import { Card, Loader, SegmentedControl, Stack, Text, Title, Group } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { useSearch, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { FilterBar } from '../components/FilterBar';
import { useManifest } from '../hooks/useManifest';
import { buildWhere } from '../lib/filter';
import { query } from '../lib/duckdb/query';
import { eventsFrom } from '../queries/runsParquet';

interface CellRow {
  x: number;
  y: number;
  c: number;
}

export function HeatmapPage() {
  const search = useSearch({ from: '/heatmap' });
  const navigate = useNavigate();
  const { data: manifest } = useManifest();
  const [layer, setLayer] = useState<'PlayerMoved' | 'PlantPlaced'>('PlayerMoved');
  const filterKey = JSON.stringify(search);

  const { data: cells, isLoading } = useQuery({
    queryKey: ['heatmap', layer, filterKey, manifest?.generatedAt],
    enabled: !!manifest && manifest.datasets.length > 0,
    queryFn: async () => {
      if (!manifest) return [];
      const where = buildWhere(search);
      // PlayerMoved は payload.to を、PlantPlaced は payload.position を使う
      const field = layer === 'PlayerMoved' ? 'to' : 'position';
      const sql = `
        WITH src AS (
          SELECT json_extract_string(payload, '$.${field}') AS pos
          FROM ${eventsFrom(manifest.datasets)}
          ${where}${where ? ' AND' : 'WHERE'} event_type = '${layer}'
            AND json_extract_string(payload, '$.${field}') IS NOT NULL
        )
        SELECT
          CAST(split_part(pos, ',', 1) AS INTEGER) AS x,
          CAST(split_part(pos, ',', 2) AS INTEGER) AS y,
          COUNT(*)::INTEGER AS c
        FROM src
        GROUP BY 1, 2
        ORDER BY 1, 2
      `;
      return await query<CellRow>(sql);
    },
  });

  return (
    <Stack>
      <Title order={2}>マップヒートマップ</Title>
      <FilterBar
        filter={search}
        navigateTo={{ to: '/heatmap' }}
      />
      <Group>
        <SegmentedControl
          value={layer}
          onChange={(v) => setLayer(v as 'PlayerMoved' | 'PlantPlaced')}
          data={[
            { label: '移動 (PlayerMoved)', value: 'PlayerMoved' },
            { label: '配置 (PlantPlaced)', value: 'PlantPlaced' },
          ]}
        />
      </Group>
      <Card withBorder padding="md">
        {isLoading ? (
          <Loader />
        ) : !cells || cells.length === 0 ? (
          <Text c="dimmed">データなし</Text>
        ) : (
          <HeatmapCanvas cells={cells} />
        )}
      </Card>
    </Stack>
  );
}

function HeatmapCanvas({ cells }: { cells: CellRow[] }) {
  // x/y の min/max を計算
  let xMin = Number.POSITIVE_INFINITY;
  let xMax = Number.NEGATIVE_INFINITY;
  let yMin = Number.POSITIVE_INFINITY;
  let yMax = Number.NEGATIVE_INFINITY;
  let maxC = 0;
  for (const c of cells) {
    if (c.x < xMin) xMin = c.x;
    if (c.x > xMax) xMax = c.x;
    if (c.y < yMin) yMin = c.y;
    if (c.y > yMax) yMax = c.y;
    if (c.c > maxC) maxC = c.c;
  }
  const width = xMax - xMin + 1;
  const height = yMax - yMin + 1;
  const size = 32;

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${width}, ${size}px)`,
        gap: 2,
        justifyContent: 'center',
      }}
    >
      {Array.from({ length: width * height }).map((_, idx) => {
        const x = xMin + (idx % width);
        const y = yMin + Math.floor(idx / width);
        const cell = cells.find((c) => c.x === x && c.y === y);
        const intensity = cell ? cell.c / maxC : 0;
        const bg = `rgba(38, 138, 47, ${intensity})`;
        return (
          <div
            key={`${x}-${y}`}
            style={{
              width: size,
              height: size,
              background: bg,
              border: '1px solid rgba(255,255,255,0.05)',
              fontSize: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: intensity > 0.5 ? 'white' : '#888',
            }}
            title={`(${x}, ${y}) = ${cell?.c ?? 0}`}
          >
            {cell?.c ?? ''}
          </div>
        );
      })}
    </div>
  );
}
