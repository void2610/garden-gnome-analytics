import { MantineProvider } from '@mantine/core';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AiChatPanel } from './AiChatPanel';

// 中のチャットは manifest の取得などを伴うので外し、幅の変更だけを試す
vi.mock('./AiChatSidebar', () => ({ AiChatSidebar: () => null }));

// パネルは画面の右端から 12px 離して置くので、幅 w になる左端の位置
const xForWidth = (w: number) => window.innerWidth - 12 - w;

describe('AiChatPanel', () => {
  beforeEach(() => {
    localStorage.clear();
    // テスト環境にポインターキャプチャが無いときに備える
    HTMLElement.prototype.setPointerCapture ??= () => {};
    HTMLElement.prototype.releasePointerCapture ??= () => {};
  });

  it('ドラッグを離した位置の幅で開き、その幅を覚える', () => {
    render(
      <MantineProvider>
        <AiChatPanel opened onClose={() => {}} />
      </MantineProvider>,
    );
    const handle = screen.getByRole('separator', { name: 'AI チャットの幅を変える' });

    fireEvent.pointerDown(handle, { pointerId: 1, clientX: xForWidth(420) });
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: xForWidth(450) });
    fireEvent.pointerUp(handle, { pointerId: 1, clientX: xForWidth(500) });

    expect(handle.parentElement).toHaveStyle({ width: '500px' });
    expect(localStorage.getItem('gga.aiChatWidth')).toBe('500');
  });
});
