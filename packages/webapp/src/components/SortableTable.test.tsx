import { MantineProvider } from '@mantine/core';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { SortableTable, type SortableColumn } from './SortableTable';

interface Row {
  id: string;
  name: string;
  value: number;
}

const ROWS: Row[] = [
  { id: '1', name: 'Apple', value: 30 },
  { id: '2', name: 'Banana', value: 10 },
  { id: '3', name: 'Cherry', value: 20 },
  { id: '4', name: 'Apple', value: 5 },
  { id: '5', name: 'Banana', value: 50 },
  { id: '6', name: 'Apple', value: 15 },
];

const COLUMNS: SortableColumn<Row>[] = [
  { key: 'name', label: 'name', accessor: (r) => r.name },
  { key: 'value', label: 'value', accessor: (r) => r.value, numeric: true },
];

function renderTable(rows: Row[], defaultSort?: Record<string, 'asc' | 'desc'>) {
  return render(
    <MantineProvider>
      <SortableTable
        columns={COLUMNS}
        rows={rows}
        rowKey={(r) => r.id}
        defaultSort={defaultSort}
      />
    </MantineProvider>,
  );
}

function getRowCount(): number {
  return screen.getAllByRole('row').length - 1;
}

function getCol(colIndex: number): string[] {
  const rows = screen.getAllByRole('row').slice(1);
  return rows.map((tr) => {
    const cells = tr.querySelectorAll('td');
    return cells[colIndex]?.textContent?.trim() ?? '';
  });
}

describe('SortableTable - 単一列のトグル', () => {
  it('初期状態で行数が rows と一致', () => {
    renderTable(ROWS);
    expect(getRowCount()).toBe(6);
  });

  it('連続クリックしても行数は不変', async () => {
    const user = userEvent.setup();
    renderTable(ROWS);
    for (let i = 0; i < 6; i++) {
      await user.click(screen.getByText('value'));
      expect(getRowCount()).toBe(6);
    }
  });

  it('数値列: クリック none → desc → asc → none を循環', async () => {
    const user = userEvent.setup();
    renderTable(ROWS);
    // 初期 (none) → クリック 1 で desc
    await user.click(screen.getByText('value'));
    expect(getCol(1)).toEqual(['50', '30', '20', '15', '10', '5']);
    // クリック 2 で asc
    await user.click(screen.getByText('value'));
    expect(getCol(1)).toEqual(['5', '10', '15', '20', '30', '50']);
    // クリック 3 で none → 元の順序
    await user.click(screen.getByText('value'));
    expect(getCol(1)).toEqual(['30', '10', '20', '5', '50', '15']);
  });

  it('文字列列: クリック none → asc → desc → none を循環', async () => {
    const user = userEvent.setup();
    renderTable(ROWS);
    await user.click(screen.getByText('name'));
    // 昇順
    expect(getCol(0)).toEqual([
      'Apple',
      'Apple',
      'Apple',
      'Banana',
      'Banana',
      'Cherry',
    ]);
  });
});

describe('SortableTable - 複数列の優先度は列の左→右順', () => {
  it('列1 (name 昇順) と 列2 (value 降順) を独立にトグルすると、列順で並ぶ', async () => {
    const user = userEvent.setup();
    renderTable(ROWS);
    // どちらをクリックする順番でも結果は同じ (= columns の順番が優先度)
    await user.click(screen.getByText('value')); // value desc が先に立つ
    await user.click(screen.getByText('name')); // 後から name asc

    expect(getCol(0)).toEqual([
      'Apple',
      'Apple',
      'Apple',
      'Banana',
      'Banana',
      'Cherry',
    ]);
    expect(getCol(1)).toEqual(['30', '15', '5', '50', '10', '20']);
  });

  it('クリック順を逆にしても結果が同じ (列順が優先度)', async () => {
    const user = userEvent.setup();
    renderTable(ROWS);
    await user.click(screen.getByText('name')); // name asc 先
    await user.click(screen.getByText('value')); // value desc 後

    expect(getCol(0)).toEqual([
      'Apple',
      'Apple',
      'Apple',
      'Banana',
      'Banana',
      'Cherry',
    ]);
    expect(getCol(1)).toEqual(['30', '15', '5', '50', '10', '20']);
  });

  it('複数列ソート中も行数は不変', async () => {
    const user = userEvent.setup();
    renderTable(ROWS);
    for (let i = 0; i < 5; i++) {
      await user.click(screen.getByText('name'));
      await user.click(screen.getByText('value'));
      expect(getRowCount()).toBe(6);
    }
  });

  it('1 列だけソートすると、ほかの列は影響しない', async () => {
    const user = userEvent.setup();
    renderTable(ROWS);
    await user.click(screen.getByText('value')); // value desc
    expect(getCol(1)).toEqual(['50', '30', '20', '15', '10', '5']);
    // name は触っていないので、value 降順のみで並ぶ
  });
});

describe('SortableTable - defaultSort', () => {
  it('defaultSort に複数キーを渡すと初期から複数列ソートが効く', () => {
    renderTable(ROWS, { name: 'asc', value: 'desc' });
    expect(getCol(0)).toEqual([
      'Apple',
      'Apple',
      'Apple',
      'Banana',
      'Banana',
      'Cherry',
    ]);
    expect(getCol(1)).toEqual(['30', '15', '5', '50', '10', '20']);
  });
});
