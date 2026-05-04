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

describe('SortableTable - 単一キーソート', () => {
  it('初期状態で行数が rows と一致する', () => {
    renderTable(ROWS);
    expect(getRowCount()).toBe(6);
  });

  it('クリックを繰り返しても行数が増えない', async () => {
    const user = userEvent.setup();
    renderTable(ROWS);
    for (let i = 0; i < 5; i++) {
      await user.click(screen.getByText('value'));
      expect(getRowCount()).toBe(6);
    }
  });

  it('value 列クリックで降順 → もう一度で昇順', async () => {
    const user = userEvent.setup();
    renderTable(ROWS);
    await user.click(screen.getByText('value'));
    expect(getCol(1)).toEqual(['50', '30', '20', '15', '10', '5']);
    await user.click(screen.getByText('value'));
    expect(getCol(1)).toEqual(['5', '10', '15', '20', '30', '50']);
  });
});

describe('SortableTable - 複数キーソート', () => {
  it('Shift+クリックで第二キーが追加され、name 昇順 + value 降順 で並ぶ', async () => {
    const user = userEvent.setup();
    renderTable(ROWS);

    // 第一キー: name (昇順、デフォルト)
    await user.click(screen.getByText('name'));
    // 第二キー: value (Shift+クリック → デフォルト降順)
    await user.keyboard('{Shift>}');
    await user.click(screen.getByText('value'));
    await user.keyboard('{/Shift}');

    // name 昇順、同 name 内では value 降順
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

  it('Shift+クリック 2 回で第二キーの方向が反転する', async () => {
    const user = userEvent.setup();
    renderTable(ROWS);
    await user.click(screen.getByText('name')); // name 昇順

    // value 追加 (1回目: 降順)
    await user.keyboard('{Shift>}');
    await user.click(screen.getByText('value'));
    expect(getCol(1)).toEqual(['30', '15', '5', '50', '10', '20']);

    // 2回目: 昇順に反転
    await user.click(screen.getByText('value'));
    await user.keyboard('{/Shift}');
    expect(getCol(1)).toEqual(['5', '15', '30', '10', '50', '20']);
  });

  it('Shift+クリック 3 回で第二キーが削除される', async () => {
    const user = userEvent.setup();
    renderTable(ROWS);
    await user.click(screen.getByText('name'));

    await user.keyboard('{Shift>}');
    await user.click(screen.getByText('value')); // 降順
    await user.click(screen.getByText('value')); // 昇順
    await user.click(screen.getByText('value')); // 削除
    await user.keyboard('{/Shift}');

    // value のソートは外れ、name のみで安定
    // name のみソートだと同 name 内の順序は不定なので、name 列だけ検証
    expect(getCol(0)).toEqual([
      'Apple',
      'Apple',
      'Apple',
      'Banana',
      'Banana',
      'Cherry',
    ]);
  });

  it('単一クリック (Shift なし) は複数キーをリセットして単一にする', async () => {
    const user = userEvent.setup();
    renderTable(ROWS);
    await user.click(screen.getByText('name'));
    await user.keyboard('{Shift>}');
    await user.click(screen.getByText('value'));
    await user.keyboard('{/Shift}');
    // この時点で複数キー (name, value)

    // 通常クリックすると単一キーに戻る
    await user.click(screen.getByText('value'));
    // value 単独 (降順がデフォルト) なら 50,30,20,15,10,5
    expect(getCol(1)).toEqual(['50', '30', '20', '15', '10', '5']);
  });

  it('複数キーソート中も行数は不変', async () => {
    const user = userEvent.setup();
    renderTable(ROWS);
    for (let i = 0; i < 5; i++) {
      await user.keyboard('{Shift>}');
      await user.click(screen.getByText('name'));
      await user.click(screen.getByText('value'));
      await user.keyboard('{/Shift}');
      expect(getRowCount()).toBe(6);
    }
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
