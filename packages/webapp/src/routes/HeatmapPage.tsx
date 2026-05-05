import {
  Alert,
  Card,
  Checkbox,
  Group,
  RangeSlider,
  Select,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { useEffect, useMemo } from 'react';
import { FilterBar } from '../components/FilterBar';
import { QueryError } from '../components/QueryError';
import { useManifest } from '../hooks/useManifest';
import { query } from '../lib/duckdb/query';
import { buildWhere, buildWhereRuns } from '../lib/filter';
import type { ManifestDataset } from '../lib/manifest';
import { eventsFrom, runsFrom } from '../queries/runsParquet';

type LayerKey = 'moves' | 'presence' | 'plants' | 'paths';

const LAYER_DEFAULT: LayerKey[] = ['moves', 'plants'];

const LAYER_META: Record<LayerKey, { label: string; color: string }> = {
  moves: { label: '移動先 (PlayerMoved.to)', color: '#3fae37' },
  presence: { label: '滞在頻度 (from + to)', color: '#288722' },
  plants: { label: '配置 (PlantPlaced)', color: '#f08c00' },
  paths: { label: '経路 (from→to)', color: '#1971c2' },
};

interface CellRow {
  x: number;
  y: number;
  c: number;
}

interface EdgeRow {
  fx: number;
  fy: number;
  tx: number;
  ty: number;
  c: number;
}

interface MapOption {
  map_name: string;
  c: number;
}

interface RunTimeRange {
  min_ts: string | null;
  max_ts: string | null;
}

// 各 run 内で BattleStart.mapName を後続行に前方フィルし、PlayerMoved 等を
// マップ単位で集計可能にする CTE。stage_type / stage_id は HeatmapPage では
// 使わないため列に含めない。
function withMapFilledCte(eventsFromExpr: string, where: string): string {
  return `
    WITH ev AS (
      SELECT
        event_slug, device_slug, run_id, seq, event_type, payload, timestamp,
        CASE WHEN event_type = 'BattleStart'
             THEN json_extract_string(payload, '$.mapName') END AS battle_map_name
      FROM ${eventsFromExpr}
      ${where}
    ),
    filled AS (
      SELECT
        *,
        LAST_VALUE(battle_map_name IGNORE NULLS) OVER (
          PARTITION BY event_slug, device_slug, run_id
          ORDER BY seq ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
        ) AS map_name
      FROM ev
    )
  `;
}

export function HeatmapPage() {
  const search = useSearch({ from: '/heatmap' });
  const navigate = useNavigate();
  const { data: manifest } = useManifest();
  const filterKey = JSON.stringify(search);

  const layers = search.layers ?? LAYER_DEFAULT;
  const mapName = search.mapName;

  // hasMapName=true のデータセットのみがマップ単位の集計対象
  const mapDatasets: ManifestDataset[] = useMemo(
    () => manifest?.datasets.filter((d) => d.hasMapName) ?? [],
    [manifest],
  );
  const hasAnyMapData = mapDatasets.length > 0;

  function update(patch: Partial<typeof search>) {
    navigate({
      to: '/heatmap',
      // biome-ignore lint/suspicious/noExplicitAny: TanStack Router の search 動的型
      search: ((prev: typeof search) => ({ ...prev, ...patch })) as any,
      replace: true,
    });
  }

  // 利用可能なマップ ID 一覧
  const { data: mapOptions } = useQuery({
    queryKey: ['heatmap-maps', filterKey, manifest?.generatedAt],
    enabled: hasAnyMapData,
    queryFn: async () => {
      const where = buildWhere(search);
      const sql = `
        SELECT
          json_extract_string(payload, '$.mapName') AS map_name,
          COUNT(*)::INTEGER AS c
        FROM ${eventsFrom(mapDatasets)}
        ${where}${where ? ' AND' : 'WHERE'} event_type = 'BattleStart'
          AND json_extract_string(payload, '$.mapName') IS NOT NULL
          AND json_extract_string(payload, '$.mapName') <> ''
        GROUP BY 1
        ORDER BY c DESC
      `;
      return await query<MapOption>(sql);
    },
  });

  // 初期表示時に最も出現数の多いマップを自動選択
  // biome-ignore lint/correctness/useExhaustiveDependencies: mapName は意図的に依存から除外
  useEffect(() => {
    if (mapName) return;
    if (!mapOptions || mapOptions.length === 0) return;
    const top = mapOptions[0];
    if (top) update({ mapName: top.map_name });
  }, [mapOptions]);

  // 時間スライダの取りうる範囲 (run.started_at の min/max)
  const { data: timeRange } = useQuery({
    queryKey: ['heatmap-time-range', filterKey, manifest?.generatedAt],
    enabled: hasAnyMapData,
    queryFn: async () => {
      const where = buildWhereRuns(search);
      const sql = `
        SELECT MIN(started_at)::VARCHAR AS min_ts, MAX(started_at)::VARCHAR AS max_ts
        FROM ${runsFrom(mapDatasets)}
        ${where}
      `;
      const [row] = await query<RunTimeRange>(sql);
      return row ?? null;
    },
  });

  const minSec = timeRange?.min_ts ? Math.floor(new Date(timeRange.min_ts).getTime() / 1000) : null;
  const maxSec = timeRange?.max_ts ? Math.ceil(new Date(timeRange.max_ts).getTime() / 1000) : null;
  const sliderFrom = search.timeFrom ?? minSec ?? 0;
  const sliderTo = search.timeTo ?? maxSec ?? 0;

  // 共通の WHERE 句生成: マップ ID と時間スライダで絞る
  const whereFragments = useMemo(() => {
    const f: string[] = [];
    if (mapName) {
      f.push(`map_name = '${mapName.replace(/'/g, "''")}'`);
    }
    if (search.timeFrom != null) {
      const ts = new Date(search.timeFrom * 1000).toISOString();
      f.push(`timestamp >= TIMESTAMP '${ts}'`);
    }
    if (search.timeTo != null) {
      const ts = new Date(search.timeTo * 1000).toISOString();
      f.push(`timestamp <= TIMESTAMP '${ts}'`);
    }
    return f.length > 0 ? `AND ${f.join(' AND ')}` : '';
  }, [mapName, search.timeFrom, search.timeTo]);

  // ヒートマップ用セル集計 (移動先/滞在頻度/配置)
  const { data: cellData, error: cellErr } = useQuery({
    queryKey: ['heatmap-cells', filterKey, layers.join(','), manifest?.generatedAt],
    enabled: hasAnyMapData && !!mapName,
    queryFn: async () => {
      const where = buildWhere(search);
      const cte = withMapFilledCte(eventsFrom(mapDatasets), where);

      const movesSql = `
        ${cte}
        SELECT
          CAST(split_part(json_extract_string(payload, '$.to'), ',', 1) AS INTEGER) AS x,
          CAST(split_part(json_extract_string(payload, '$.to'), ',', 2) AS INTEGER) AS y,
          COUNT(*)::INTEGER AS c
        FROM filled
        WHERE event_type = 'PlayerMoved'
          AND json_extract_string(payload, '$.to') IS NOT NULL
          ${whereFragments}
        GROUP BY 1, 2
      `;
      const presenceSql = `
        ${cte},
        positions AS (
          SELECT json_extract_string(payload, '$.from') AS pos
          FROM filled
          WHERE event_type = 'PlayerMoved'
            AND json_extract_string(payload, '$.from') IS NOT NULL
            ${whereFragments}
          UNION ALL
          SELECT json_extract_string(payload, '$.to') AS pos
          FROM filled
          WHERE event_type = 'PlayerMoved'
            AND json_extract_string(payload, '$.to') IS NOT NULL
            ${whereFragments}
        )
        SELECT
          CAST(split_part(pos, ',', 1) AS INTEGER) AS x,
          CAST(split_part(pos, ',', 2) AS INTEGER) AS y,
          COUNT(*)::INTEGER AS c
        FROM positions
        GROUP BY 1, 2
      `;
      const plantsSql = `
        ${cte}
        SELECT
          CAST(split_part(json_extract_string(payload, '$.position'), ',', 1) AS INTEGER) AS x,
          CAST(split_part(json_extract_string(payload, '$.position'), ',', 2) AS INTEGER) AS y,
          COUNT(*)::INTEGER AS c
        FROM filled
        WHERE event_type = 'PlantPlaced'
          AND json_extract_string(payload, '$.position') IS NOT NULL
          ${whereFragments}
        GROUP BY 1, 2
      `;

      const [moves, presence, plants] = await Promise.all([
        layers.includes('moves') ? query<CellRow>(movesSql) : Promise.resolve([] as CellRow[]),
        layers.includes('presence')
          ? query<CellRow>(presenceSql)
          : Promise.resolve([] as CellRow[]),
        layers.includes('plants') ? query<CellRow>(plantsSql) : Promise.resolve([] as CellRow[]),
      ]);
      return { moves, presence, plants };
    },
  });

  // 経路 (PlayerMoved.from → .to)
  const { data: edges } = useQuery({
    queryKey: ['heatmap-paths', filterKey, layers.includes('paths'), manifest?.generatedAt],
    enabled: hasAnyMapData && !!mapName && layers.includes('paths'),
    queryFn: async () => {
      const where = buildWhere(search);
      const cte = withMapFilledCte(eventsFrom(mapDatasets), where);
      const sql = `
        ${cte}
        SELECT
          CAST(split_part(json_extract_string(payload, '$.from'), ',', 1) AS INTEGER) AS fx,
          CAST(split_part(json_extract_string(payload, '$.from'), ',', 2) AS INTEGER) AS fy,
          CAST(split_part(json_extract_string(payload, '$.to'),   ',', 1) AS INTEGER) AS tx,
          CAST(split_part(json_extract_string(payload, '$.to'),   ',', 2) AS INTEGER) AS ty,
          COUNT(*)::INTEGER AS c
        FROM filled
        WHERE event_type = 'PlayerMoved'
          AND json_extract_string(payload, '$.from') IS NOT NULL
          AND json_extract_string(payload, '$.to') IS NOT NULL
          ${whereFragments}
        GROUP BY 1, 2, 3, 4
      `;
      return await query<EdgeRow>(sql);
    },
  });

  // マップ Select 用データ (Stage1 / Stage1-Common / ... のような prefix で
  // ゆるくグループ化する)
  const mapSelectData = useMemo(() => {
    if (!mapOptions) return [];
    const grouped = new Map<string, { value: string; label: string }[]>();
    for (const o of mapOptions) {
      const m = o.map_name.match(/^(.+?-[^-]+)/);
      const groupKey = m?.[1] ?? 'Other';
      const item = { value: o.map_name, label: `${o.map_name} (n=${o.c})` };
      const arr = grouped.get(groupKey);
      if (arr) arr.push(item);
      else grouped.set(groupKey, [item]);
    }
    return [...grouped.entries()].map(([group, items]) => ({ group, items }));
  }, [mapOptions]);

  if (!manifest) return null;

  // mapName を含むデータセットが 1 件もない場合は機能を停止
  if (!hasAnyMapData) {
    return (
      <Stack>
        <Title order={2}>マップヒートマップ</Title>
        <Alert icon={<IconAlertCircle size={16} />} color="yellow" title="マップ情報がありません">
          ヒートマップはバトルログの <code>mapName</code> 列を使ってマップ単位で集計します。
          現在 manifest 上で <code>hasMapName: true</code> のデータセットがないため表示できません。
          ゲーム本体に mapName を記録するロギング (PR #192) が含まれた版でログを取り直してください。
        </Alert>
      </Stack>
    );
  }

  return (
    <Stack>
      <Title order={2}>マップヒートマップ</Title>
      <Text c="dimmed" size="sm">
        マップ単位で移動 / 配置 / 経路を集計。
        {manifest.datasets.length > mapDatasets.length &&
          ` (mapName 未記録のデータセット ${manifest.datasets.length - mapDatasets.length} 件は除外)`}
      </Text>
      <FilterBar filter={search} navigateTo={{ to: '/heatmap' }} />
      <QueryError error={cellErr} />

      <Card withBorder padding="sm">
        <Stack gap="xs">
          <Select
            label="マップ ID"
            placeholder="マップを選択"
            description="BattleStart.mapName。マップごとにレイアウトが異なる"
            data={mapSelectData}
            value={mapName ?? null}
            onChange={(v) => update({ mapName: v ?? undefined })}
            searchable
            allowDeselect={false}
          />
          <Group gap="md">
            {(Object.keys(LAYER_META) as LayerKey[]).map((k) => (
              <Checkbox
                key={k}
                label={
                  <span>
                    <span
                      style={{
                        display: 'inline-block',
                        width: 10,
                        height: 10,
                        background: LAYER_META[k].color,
                        marginRight: 6,
                        borderRadius: 2,
                      }}
                    />
                    {LAYER_META[k].label}
                  </span>
                }
                checked={layers.includes(k)}
                onChange={(e) => {
                  const next = e.currentTarget.checked
                    ? [...layers.filter((x) => x !== k), k]
                    : layers.filter((x) => x !== k);
                  update({ layers: next.length > 0 ? next : undefined });
                }}
              />
            ))}
          </Group>
          {minSec != null && maxSec != null && minSec < maxSec && (
            <div>
              <Text size="xs" c="dimmed" mb={4}>
                時間帯フィルタ:{' '}
                {new Date(sliderFrom * 1000).toLocaleString('ja-JP')} 〜{' '}
                {new Date(sliderTo * 1000).toLocaleString('ja-JP')}
              </Text>
              <RangeSlider
                key={`${minSec}-${maxSec}`}
                min={minSec}
                max={maxSec}
                defaultValue={[sliderFrom, sliderTo]}
                onChangeEnd={([from, to]) =>
                  update({
                    timeFrom: from === minSec ? undefined : from,
                    timeTo: to === maxSec ? undefined : to,
                  })
                }
                label={(v) => new Date(v * 1000).toLocaleTimeString('ja-JP')}
              />
            </div>
          )}
        </Stack>
      </Card>

      <Card withBorder padding="md">
        {!mapName ? (
          <Text c="dimmed">マップを選択してください</Text>
        ) : (
          <HeatmapSvg
            movesCells={cellData?.moves ?? []}
            presenceCells={cellData?.presence ?? []}
            plantsCells={cellData?.plants ?? []}
            edges={edges ?? []}
            layers={layers}
          />
        )}
      </Card>
    </Stack>
  );
}

interface HeatmapSvgProps {
  movesCells: CellRow[];
  presenceCells: CellRow[];
  plantsCells: CellRow[];
  edges: EdgeRow[];
  layers: LayerKey[];
}

function HeatmapSvg({
  movesCells,
  presenceCells,
  plantsCells,
  edges,
  layers,
}: HeatmapSvgProps) {
  const allPoints: Array<{ x: number; y: number }> = [];
  for (const c of movesCells) allPoints.push({ x: c.x, y: c.y });
  for (const c of presenceCells) allPoints.push({ x: c.x, y: c.y });
  for (const c of plantsCells) allPoints.push({ x: c.x, y: c.y });
  for (const e of edges) {
    allPoints.push({ x: e.fx, y: e.fy });
    allPoints.push({ x: e.tx, y: e.ty });
  }

  if (allPoints.length === 0) {
    return <Text c="dimmed">データなし</Text>;
  }

  let xMin = Number.POSITIVE_INFINITY;
  let xMax = Number.NEGATIVE_INFINITY;
  let yMin = Number.POSITIVE_INFINITY;
  let yMax = Number.NEGATIVE_INFINITY;
  for (const p of allPoints) {
    if (p.x < xMin) xMin = p.x;
    if (p.x > xMax) xMax = p.x;
    if (p.y < yMin) yMin = p.y;
    if (p.y > yMax) yMax = p.y;
  }
  const width = xMax - xMin + 1;
  const height = yMax - yMin + 1;
  const cellSize = 36;
  const svgW = width * cellSize;
  const svgH = height * cellSize;

  const maxMoves = movesCells.reduce((m, c) => Math.max(m, c.c), 0);
  const maxPresence = presenceCells.reduce((m, c) => Math.max(m, c.c), 0);
  const maxPlants = plantsCells.reduce((m, c) => Math.max(m, c.c), 0);
  const maxEdges = edges.reduce((m, e) => Math.max(m, e.c), 0);

  function px(x: number) {
    return (x - xMin) * cellSize;
  }
  function py(y: number) {
    return (y - yMin) * cellSize;
  }
  function center(x: number, y: number) {
    return { cx: px(x) + cellSize / 2, cy: py(y) + cellSize / 2 };
  }

  return (
    <div style={{ overflow: 'auto', display: 'flex', justifyContent: 'center' }}>
      <svg
        width={svgW}
        height={svgH}
        viewBox={`0 0 ${svgW} ${svgH}`}
        style={{ background: 'rgba(255,255,255,0.02)' }}
        role="img"
        aria-label="プレイヤー移動・植物配置・経路を重ねたマップヒートマップ"
      >
        <title>マップヒートマップ</title>
        {Array.from({ length: width * height }).map((_, idx) => {
          const x = xMin + (idx % width);
          const y = yMin + Math.floor(idx / width);
          return (
            <rect
              key={`g-${x}-${y}`}
              x={px(x)}
              y={py(y)}
              width={cellSize}
              height={cellSize}
              fill="transparent"
              stroke="rgba(255,255,255,0.06)"
            />
          );
        })}

        {layers.includes('moves') &&
          movesCells.map((c) => (
            <rect
              key={`m-${c.x}-${c.y}`}
              x={px(c.x)}
              y={py(c.y)}
              width={cellSize}
              height={cellSize}
              fill={LAYER_META.moves.color}
              fillOpacity={maxMoves > 0 ? c.c / maxMoves : 0}
            >
              <title>{`移動先 (${c.x},${c.y}) = ${c.c}`}</title>
            </rect>
          ))}

        {layers.includes('presence') &&
          presenceCells.map((c) => (
            <rect
              key={`p-${c.x}-${c.y}`}
              x={px(c.x)}
              y={py(c.y)}
              width={cellSize}
              height={cellSize}
              fill={LAYER_META.presence.color}
              fillOpacity={maxPresence > 0 ? (c.c / maxPresence) * 0.6 : 0}
            >
              <title>{`滞在 (${c.x},${c.y}) = ${c.c}`}</title>
            </rect>
          ))}

        {layers.includes('plants') &&
          plantsCells.map((c) => (
            <circle
              key={`pl-${c.x}-${c.y}`}
              cx={center(c.x, c.y).cx}
              cy={center(c.x, c.y).cy}
              r={(cellSize / 2) * (maxPlants > 0 ? 0.3 + 0.6 * (c.c / maxPlants) : 0.3)}
              fill={LAYER_META.plants.color}
              fillOpacity={0.7}
            >
              <title>{`配置 (${c.x},${c.y}) = ${c.c}`}</title>
            </circle>
          ))}

        {layers.includes('paths') &&
          edges.map((e) => {
            const a = center(e.fx, e.fy);
            const b = center(e.tx, e.ty);
            const w = maxEdges > 0 ? 1 + (e.c / maxEdges) * 4 : 1;
            return (
              <line
                key={`e-${e.fx}-${e.fy}-${e.tx}-${e.ty}`}
                x1={a.cx}
                y1={a.cy}
                x2={b.cx}
                y2={b.cy}
                stroke={LAYER_META.paths.color}
                strokeOpacity={0.4}
                strokeWidth={w}
                strokeLinecap="round"
              >
                <title>{`(${e.fx},${e.fy}) → (${e.tx},${e.ty}) = ${e.c}`}</title>
              </line>
            );
          })}

        {layers.includes('moves') &&
          movesCells.map((c) => (
            <text
              key={`t-${c.x}-${c.y}`}
              x={center(c.x, c.y).cx}
              y={center(c.x, c.y).cy + 3}
              textAnchor="middle"
              fontSize={10}
              fill={maxMoves > 0 && c.c / maxMoves > 0.5 ? 'white' : '#aaa'}
              pointerEvents="none"
            >
              {c.c}
            </text>
          ))}
      </svg>
    </div>
  );
}
