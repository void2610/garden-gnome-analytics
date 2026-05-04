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

function renderTable(rows: Row[]) {
  return render(
    <MantineProvider>
      <SortableTable columns={COLUMNS} rows={rows} rowKey={(r) => r.id} />
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

describe('SortableTable - 単一列の 3 段階トグル', () => {
  it('初期状態で行数が rows と一致する', () => {
    renderTable(ROWS);
    expect(getRowCount()).toBe(6);
  });

  it('クリックを繰り返しても行数が増えない', async () => {
    const user = userEvent.setup();
    renderTable(ROWS);
    for (let i = 0; i < 6; i++) {
      await user.click(screen.getByText('value'));
      expect(getRowCount()).toBe(6);
    }
  });

  it('value 1回 → 降順 / 2回 → 昇順 / 3回 → 解除', async () => {
    const user = userEvent.setup();
    renderTable(ROWS);

    // 1 回目: 数値列なのでデフォルト降順
    await user.click(screen.getByText('value'));
    expect(getCol(1)).toEqual(['50', '30', '20', '15', '10', '5']);

    // 2 回目: 反対方向
    await user.click(screen.getByText('value'));
    expect(getCol(1)).toEqual(['5', '10', '15', '20', '30', '50']);

    // 3 回目: ソートが外れる（行数だけ確認、順序は元の挿入順）
    await user.click(screen.getByText('value'));
    expect(getRowCount()).toBe(6);
    expect(getCol(1)).toEqual(['30', '10', '20', '5', '50', '15']);
  });
});

describe('SortableTable - 複数キーソート (Shift なし)', () => {
  it('別の列をクリックすると末尾にキーが追加される (name 昇順 + value 降順)', async () => {
    const user = userEvent.setup();
    renderTable(ROWS);

    // 1 つ目: name (デフォルト昇順)
    await user.click(screen.getByText('name'));
    // 2 つ目: value (デフォルト降順)
    await user.click(screen.getByText('value'));

    // name 昇順を第一キー、value 降順を第二キーとして並ぶ
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

  it('同じ列をもう一度クリックすると優先度はそのままで方向だけ反転する', async () => {
    const user = userEvent.setup();
    renderTable(ROWS);
    await user.click(screen.getByText('name')); // name 昇順
    await user.click(screen.getByText('value')); // value 降順

    // value をもう一度 → 昇順に反転、name は第一キーのまま
    await user.click(screen.getByText('value'));
    expect(getCol(0)).toEqual([
      'Apple',
      'Apple',
      'Apple',
      'Banana',
      'Banana',
      'Cherry',
    ]);
    expect(getCol(1)).toEqual(['5', '15', '30', '10', '50', '20']);
  });

  it('同じ列を 3 回クリックすると複数キーから外れる', async () => {
    const user = userEvent.setup();
    renderTable(ROWS);
    await user.click(screen.getByText('name')); // name 昇順
    await user.click(screen.getByText('value')); // value 降順
    await user.click(screen.getByText('value')); // value 昇順
    await user.click(screen.getByText('value')); // value 解除

    // value のソートは外れ、name のみで安定
    expect(getCol(0)).toEqual([
      'Apple',
      'Apple',
      'Apple',
      'Banana',
      'Banana',
      'Cherry',
    ]);
  });

  it('複数キーソート中も行数は不変', async () => {
    const user = userEvent.setup();
    renderTable(ROWS);
    for (let i = 0; i < 5; i++) {
      await user.click(screen.getByText('name'));
      await user.click(screen.getByText('value'));
      expect(getRowCount()).toBe(6);
    }
  });

  it('ソートをリセットボタンで一括クリアできる', async () => {
    const user = userEvent.setup();
    renderTable(ROWS);
    await user.click(screen.getByText('name'));
    await user.click(screen.getByText('value'));

    const resetBtn = screen.getByLabelText('ソートをリセット');
    await user.click(resetBtn);

    // ソート状態がクリアされ、行は元の挿入順
    expect(getCol(0)).toEqual([
      'Apple',
      'Banana',
      'Cherry',
      'Apple',
      'Banana',
      'Apple',
    ]);
  });

  it('ソート中はサマリ表示が出る', async () => {
    const user = userEvent.setup();
    renderTable(ROWS);
    await user.click(screen.getByText('name'));
    await user.click(screen.getByText('value'));
    expect(screen.getByText(/ソート:/)).toHaveTextContent('name ↑');
    expect(screen.getByText(/ソート:/)).toHaveTextContent('value ↓');
  });
});

describe('SortableTable - defaultSort', () => {
  it('defaultSort に配列を渡すと複数キーが初期適用される', () => {
    render(
      <MantineProvider>
        <SortableTable
          columns={COLUMNS}
          rows={ROWS}
          rowKey={(r) => r.id}
          defaultSort={[
            { key: 'name', direction: 'asc' },
            { key: 'value', direction: 'desc' },
          ]}
        />
      </MantineProvider>,
    );
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
