// テーブル上部に置く「フィルタ / ソート 行」。
//
// 役割:
//  - 現在の TableQuery (filters[], sort[]) をチップで表示
//  - 「+ フィルタ」「+ ソート」ボタンで Popover を開いて条件を追加
//  - チップの ✕ で個別削除、「全クリア」でまとめて削除
//
// 制御モード前提: query / onChange を必ず渡す。永続化先 (URL search / 親 useState)
// は呼び出し側の責務。
import {
  ActionIcon,
  Badge,
  Button,
  Group,
  Popover,
  Select,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import {
  IconArrowDown,
  IconArrowUp,
  IconFilter,
  IconPlus,
  IconSortAscending,
  IconX,
} from '@tabler/icons-react';
import { useMemo, useState } from 'react';
import {
  TABLE_FILTER_OP_LABEL,
  type ColumnFilterKind,
  type TableFilter,
  type TableFilterOp,
  type TableQuery,
  type TableSort,
  opsForKind,
} from '../lib/tableQuery';
import type { SortableColumn } from './SortableTable';

interface QueryBarProps<TRow> {
  columns: SortableColumn<TRow>[];
  query: TableQuery;
  onChange: (next: TableQuery) => void;
}

export function QueryBar<TRow>({ columns, query, onChange }: QueryBarProps<TRow>) {
  const filters = query.tf ?? [];
  const sorts = query.ts ?? [];

  const filterableCols = useMemo(() => columns.filter((c) => c.filter), [columns]);
  const sortableCols = columns; // ソートは全列で許可

  const colByKey = useMemo(() => new Map(columns.map((c) => [c.key, c])), [columns]);

  function setFilters(next: TableFilter[]) {
    onChange({ ...query, tf: next.length > 0 ? next : undefined });
  }
  function setSorts(next: TableSort[]) {
    onChange({ ...query, ts: next.length > 0 ? next : undefined });
  }
  function clearAll() {
    onChange({ ...query, tf: undefined, ts: undefined });
  }

  function addFilter(f: TableFilter) {
    setFilters([...filters, f]);
  }
  function removeFilter(idx: number) {
    setFilters(filters.filter((_, i) => i !== idx));
  }

  function addSort(key: string) {
    if (sorts.some((s) => s.key === key)) return;
    const col = colByKey.get(key);
    const direction = col?.numeric ? 'desc' : 'asc';
    setSorts([...sorts, { key, direction }]);
  }
  function flipSort(idx: number) {
    const cur = sorts[idx];
    if (!cur) return;
    const next = [...sorts];
    next[idx] = { ...cur, direction: cur.direction === 'asc' ? 'desc' : 'asc' };
    setSorts(next);
  }
  function removeSort(idx: number) {
    setSorts(sorts.filter((_, i) => i !== idx));
  }

  const empty = filters.length === 0 && sorts.length === 0;

  return (
    <Group gap="xs" wrap="wrap" align="center">
      <AddFilterPopover
        columns={filterableCols}
        onAdd={addFilter}
        disabled={filterableCols.length === 0}
      />
      <AddSortPopover
        columns={sortableCols}
        existingKeys={new Set(sorts.map((s) => s.key))}
        onAdd={addSort}
      />

      {filters.map((f, i) => {
        const col = colByKey.get(f.field);
        return (
          <Badge
            key={`f-${i}-${f.field}-${f.op}`}
            variant="light"
            color="blue"
            size="lg"
            rightSection={
              <ActionIcon
                size="xs"
                variant="transparent"
                color="blue"
                aria-label="このフィルタを削除"
                onClick={() => removeFilter(i)}
              >
                <IconX size={12} />
              </ActionIcon>
            }
            style={{ textTransform: 'none', fontWeight: 400 }}
          >
            {col?.label ?? f.field} {TABLE_FILTER_OP_LABEL[f.op]} {f.value || '""'}
          </Badge>
        );
      })}

      {sorts.map((s, i) => {
        const col = colByKey.get(s.key);
        const Arrow = s.direction === 'asc' ? IconArrowUp : IconArrowDown;
        return (
          <Badge
            key={`s-${i}-${s.key}`}
            variant="light"
            color="grape"
            size="lg"
            leftSection={<Arrow size={12} />}
            rightSection={
              <ActionIcon
                size="xs"
                variant="transparent"
                color="grape"
                aria-label="このソートを削除"
                onClick={(e) => {
                  // Badge 全体の onClick (方向反転) にバブリングさせない
                  e.stopPropagation();
                  removeSort(i);
                }}
              >
                <IconX size={12} />
              </ActionIcon>
            }
            style={{ textTransform: 'none', fontWeight: 400, cursor: 'pointer' }}
            onClick={() => flipSort(i)}
            title="クリックで方向反転"
          >
            {col?.label ?? s.key}
            {sorts.length > 1 ? ` (${i + 1})` : ''}
          </Badge>
        );
      })}

      {!empty && (
        <Button size="compact-xs" variant="subtle" color="gray" onClick={clearAll}>
          全クリア
        </Button>
      )}
      {empty && (
        <Text size="xs" c="dimmed">
          条件なし
        </Text>
      )}
    </Group>
  );
}

interface AddFilterPopoverProps<TRow> {
  columns: SortableColumn<TRow>[];
  onAdd: (f: TableFilter) => void;
  disabled?: boolean;
}

function AddFilterPopover<TRow>({ columns, onAdd, disabled }: AddFilterPopoverProps<TRow>) {
  const [opened, setOpened] = useState(false);
  const [field, setField] = useState<string | null>(null);
  const [op, setOp] = useState<TableFilterOp | null>(null);
  const [value, setValue] = useState('');

  const col = columns.find((c) => c.key === field);
  const kind: ColumnFilterKind = col?.filter?.kind ?? 'text';
  const ops = field ? opsForKind(kind) : [];

  function reset() {
    setField(null);
    setOp(null);
    setValue('');
  }

  function submit() {
    if (!field || !op) return;
    onAdd({ field, op, value });
    reset();
    setOpened(false);
  }

  return (
    <Popover
      opened={opened}
      onChange={(o) => {
        setOpened(o);
        if (!o) reset();
      }}
      position="bottom-start"
      withArrow
      shadow="md"
      trapFocus
    >
      <Popover.Target>
        <Button
          size="compact-sm"
          variant="default"
          leftSection={<IconFilter size={14} />}
          rightSection={<IconPlus size={12} />}
          disabled={disabled}
          onClick={() => setOpened((v) => !v)}
        >
          フィルタ
        </Button>
      </Popover.Target>
      <Popover.Dropdown>
        <Stack gap="xs" w={260}>
          <Select
            label="列"
            placeholder="列を選ぶ"
            data={columns.map((c) => ({ value: c.key, label: c.label }))}
            value={field}
            onChange={(v) => {
              setField(v);
              setOp(null);
              setValue('');
            }}
            searchable
            // ドロップダウンを Popover 内に描画する。portal だと「外側クリック」扱いで Popover が閉じてしまう
            comboboxProps={{ withinPortal: false }}
          />
          {field && (
            <Select
              label="条件"
              placeholder="演算子"
              data={ops.map((o) => ({ value: o, label: TABLE_FILTER_OP_LABEL[o] }))}
              value={op}
              onChange={(v) => setOp((v as TableFilterOp) ?? null)}
              comboboxProps={{ withinPortal: false }}
            />
          )}
          {field && op && (
            <FilterValueInput
              kind={kind}
              enumOptions={col?.filter?.enumOptions}
              value={value}
              onChange={setValue}
              onSubmit={submit}
            />
          )}
          <Group justify="end" gap="xs">
            <Button
              size="compact-sm"
              variant="subtle"
              color="gray"
              onClick={() => setOpened(false)}
            >
              キャンセル
            </Button>
            <Button size="compact-sm" disabled={!field || !op} onClick={submit}>
              追加
            </Button>
          </Group>
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
}

function FilterValueInput({
  kind,
  enumOptions,
  value,
  onChange,
  onSubmit,
}: {
  kind: ColumnFilterKind;
  enumOptions?: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
}) {
  if (kind === 'enum' && enumOptions && enumOptions.length > 0) {
    return (
      <Select
        label="値"
        data={enumOptions}
        value={value || null}
        onChange={(v) => onChange(v ?? '')}
        searchable
        comboboxProps={{ withinPortal: false }}
      />
    );
  }
  return (
    <TextInput
      label="値"
      type={kind === 'number' ? 'number' : kind === 'date' ? 'text' : 'text'}
      placeholder={kind === 'date' ? 'YYYY-MM-DD など' : ''}
      value={value}
      onChange={(e) => onChange(e.currentTarget.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onSubmit();
      }}
    />
  );
}

interface AddSortPopoverProps<TRow> {
  columns: SortableColumn<TRow>[];
  existingKeys: Set<string>;
  onAdd: (key: string) => void;
}

function AddSortPopover<TRow>({ columns, existingKeys, onAdd }: AddSortPopoverProps<TRow>) {
  const [opened, setOpened] = useState(false);
  const data = columns
    .filter((c) => !existingKeys.has(c.key))
    .map((c) => ({ value: c.key, label: c.label }));

  return (
    <Popover
      opened={opened}
      onChange={setOpened}
      position="bottom-start"
      withArrow
      shadow="md"
      trapFocus
    >
      <Popover.Target>
        <Button
          size="compact-sm"
          variant="default"
          leftSection={<IconSortAscending size={14} />}
          rightSection={<IconPlus size={12} />}
          disabled={data.length === 0}
          onClick={() => setOpened((v) => !v)}
        >
          ソート
        </Button>
      </Popover.Target>
      <Popover.Dropdown>
        <Stack gap="xs" w={240}>
          <Text size="xs" c="dimmed">
            列を選んで追加 (チップクリックで方向反転)
          </Text>
          <Select
            placeholder="列を選ぶ"
            data={data}
            onChange={(v) => {
              if (v) {
                onAdd(v);
                setOpened(false);
              }
            }}
            searchable
            comboboxProps={{ withinPortal: false }}
          />
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
}
