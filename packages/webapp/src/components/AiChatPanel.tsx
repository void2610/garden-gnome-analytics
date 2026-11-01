import { Box, Paper } from '@mantine/core';
import { useViewportSize } from '@mantine/hooks';
import { type PointerEvent, useState } from 'react';
import { AiChatSidebar } from './AiChatSidebar';

const WIDTH_STORAGE_KEY = 'gga.aiChatWidth';
const DEFAULT_WIDTH = 420;
const MIN_WIDTH = 320;
// 幅を広げても、左側の本文がこれだけは見えるようにする
const MIN_VISIBLE_MAIN = 120;
const MARGIN = 12;
const HEADER_HEIGHT = 56;

function loadWidth(): number {
  try {
    const saved = Number(localStorage.getItem(WIDTH_STORAGE_KEY));
    return saved >= MIN_WIDTH ? saved : DEFAULT_WIDTH;
  } catch {
    return DEFAULT_WIDTH;
  }
}

function saveWidth(width: number): void {
  try {
    localStorage.setItem(WIDTH_STORAGE_KEY, String(width));
  } catch {
    // 覚えられなくても、開いている間はその幅で使える
  }
}

// 本文の上に重ねて出す AI チャット。左端をドラッグして幅を変えられる
export function AiChatPanel({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const { width: viewportWidth } = useViewportSize();
  const [width, setWidth] = useState(loadWidth);
  const [resizing, setResizing] = useState(false);
  const maxWidth = Math.max(MIN_WIDTH, (viewportWidth || window.innerWidth) - MIN_VISIBLE_MAIN);
  const shownWidth = Math.min(width, maxWidth);

  const startResize = (e: PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setResizing(true);
  };

  const widthAt = (clientX: number) =>
    Math.min(Math.max(window.innerWidth - clientX - MARGIN, MIN_WIDTH), maxWidth);

  const resize = (e: PointerEvent<HTMLDivElement>) => {
    if (!resizing) return;
    setWidth(widthAt(e.clientX));
  };

  const endResize = (e: PointerEvent<HTMLDivElement>) => {
    if (!resizing) return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    setResizing(false);
    // 最後の移動がまだ描画に反映されていないことがあるので、離した位置から幅を求めて覚える
    const finalWidth = widthAt(e.clientX);
    setWidth(finalWidth);
    saveWidth(finalWidth);
  };

  return (
    <Paper
      shadow="xl"
      radius="md"
      withBorder
      style={{
        position: 'fixed',
        top: HEADER_HEIGHT + MARGIN,
        right: MARGIN,
        bottom: MARGIN,
        width: shownWidth,
        zIndex: 200,
        // 閉じても会話を残すため、消さずに隠す
        display: opened ? 'flex' : 'none',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <Box
        role="separator"
        aria-orientation="vertical"
        aria-label="AI チャットの幅を変える"
        onPointerDown={startResize}
        onPointerMove={resize}
        onPointerUp={endResize}
        onPointerCancel={endResize}
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: 0,
          width: 8,
          cursor: 'ew-resize',
          zIndex: 1,
          touchAction: 'none',
          background: resizing ? 'var(--mantine-primary-color-light)' : undefined,
        }}
      />
      <AiChatSidebar onClose={onClose} />
    </Paper>
  );
}
