import { Group, MultiSelect, TextInput } from '@mantine/core';
import { useNavigate } from '@tanstack/react-router';
import { useManifest } from '../hooks/useManifest';
import type { Filter } from '../lib/filter';

interface FilterBarProps {
  filter: Filter;
  // Router の routeId を受けて search を更新する
  navigateTo: { to: string };
}

export function FilterBar({ filter, navigateTo }: FilterBarProps) {
  const navigate = useNavigate();
  const { data: manifest } = useManifest();

  const eventOptions = uniqueOptions(
    manifest?.datasets.map((d) => ({ value: d.eventSlug, label: d.meta.event })) ?? [],
  );
  const deviceOptions = uniqueOptions(
    manifest?.datasets.map((d) => ({ value: d.deviceSlug, label: d.meta.device })) ?? [],
  );

  function update(patch: Partial<Filter>) {
    navigate({
      to: navigateTo.to,
      // biome-ignore lint/suspicious/noExplicitAny: TanStack Router の search 動的型は dynamic
      search: ((prev: Filter) => ({ ...prev, ...patch })) as any,
      replace: true,
    });
  }

  return (
    <Group align="end" wrap="wrap">
      <MultiSelect
        label="イベント"
        data={eventOptions}
        value={filter.events ?? []}
        onChange={(v) => update({ events: v.length ? v : undefined })}
        clearable
        searchable
        miw={220}
      />
      <MultiSelect
        label="機器"
        data={deviceOptions}
        value={filter.devices ?? []}
        onChange={(v) => update({ devices: v.length ? v : undefined })}
        clearable
        searchable
        miw={200}
      />
      <TextInput
        label="開始 (YYYY-MM-DD)"
        type="date"
        value={filter.dateFrom ?? ''}
        onChange={(e) => update({ dateFrom: e.currentTarget.value || undefined })}
      />
      <TextInput
        label="終了 (YYYY-MM-DD)"
        type="date"
        value={filter.dateTo ?? ''}
        onChange={(e) => update({ dateTo: e.currentTarget.value || undefined })}
      />
    </Group>
  );
}

function uniqueOptions(items: { value: string; label: string }[]) {
  const map = new Map<string, string>();
  for (const i of items) {
    if (!map.has(i.value)) map.set(i.value, i.label);
  }
  return [...map.entries()].map(([value, label]) => ({ value, label }));
}
