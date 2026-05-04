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
  { id: 'a', name: 'Apple', value: 30 },
  { id: 'b', name: 'Banana', value: 10 },
  { id: 'c', name: 'Cherry', value: 20 },
];

const COLUMNS: SortableColumn<Row>[] = [
  { key: 'name', label: 'name', accessor: (r) => r.name },
  { key: 'value', label: 'value', accessor: (r) => r.value, numeric: true },
];

function renderTable(rows: Row[]) {
  return render(
    <MantineProvider>
      <SortableTable columns={COLUMNS} rows={rows} rowKey={(r) => r.id} />
    </MantineProvider>,
  );
}

function getBodyRowCount(): number {
  return screen.getAllByRole('row').length - 1; // header 行を除く
}

function getCellTexts(colIndex: number): string[] {
  const rows = screen.getAllByRole('row').slice(1); // header を除く
  return rows.map((tr) => {
    const cells = tr.querySelectorAll('td');
    return cells[colIndex]?.textContent?.trim() ?? '';
  });
}

describe('SortableTable', () => {
  it('初期状態で行数が rows と一致する', () => {
    renderTable(ROWS);
    expect(getBodyRowCount()).toBe(3);
  });

  it('ヘッダクリックでソートしても行数は変わらない', async () => {
    const user = userEvent.setup();
    renderTable(ROWS);

    expect(getBodyRowCount()).toBe(3);
    await user.click(screen.getByText('value'));
    expect(getBodyRowCount()).toBe(3);
    await user.click(screen.getByText('value'));
    expect(getBodyRowCount()).toBe(3);
    await user.click(screen.getByText('name'));
    expect(getBodyRowCount()).toBe(3);
  });

  it('value を昇順クリックすると 10/20/30 の順', async () => {
    const user = userEvent.setup();
    renderTable(ROWS);
    // 数値列の初期は降順なので、まず desc → 30,20,10
    await user.click(screen.getByText('value'));
    expect(getCellTexts(1)).toEqual(['30', '20', '10']);
    // もう一度クリックで昇順 → 10,20,30
    await user.click(screen.getByText('value'));
    expect(getCellTexts(1)).toEqual(['10', '20', '30']);
  });

  it('クリック 5 回繰り返しても行数が増えない (重複バグ回帰検査)', async () => {
    const user = userEvent.setup();
    renderTable(ROWS);
    for (let i = 0; i < 5; i++) {
      await user.click(screen.getByText('value'));
      expect(getBodyRowCount()).toBe(3);
    }
    for (let i = 0; i < 5; i++) {
      await user.click(screen.getByText('name'));
      expect(getBodyRowCount()).toBe(3);
    }
  });

  it('元の rows 配列を mutate しない', async () => {
    const user = userEvent.setup();
    const originalSnapshot = ROWS.map((r) => ({ ...r }));
    renderTable(ROWS);
    await user.click(screen.getByText('value'));
    await user.click(screen.getByText('name'));
    expect(ROWS).toEqual(originalSnapshot);
  });
});
