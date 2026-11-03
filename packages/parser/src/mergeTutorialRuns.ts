// チュートリアルを終えた run ファイルを、直後に始まった本編の run ファイルと 1 ランにまとめる
import type { RunEvent } from '@gga/shared';

export interface RunFile {
  runId: string;
  path: string;
  events: RunEvent[];
}

export interface MergedRun {
  // 本編の runId (まとめなかったランは自身の runId)
  runId: string;
  paths: string[];
  events: RunEvent[];
}

// ゲームはチュートリアルを終えると 1 秒未満で本編の run ファイルを書き始める
const MAX_GAP_MS = 10_000;

export function mergeTutorialRuns(files: RunFile[]): MergedRun[] {
  const sorted = [...files].sort((a, b) => startMs(a) - startMs(b));
  const merged: MergedRun[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const cur = sorted[i];
    if (!cur) continue;
    const next = sorted[i + 1];
    if (next && endsWithTutorialClear(cur) && !isTutorial(next) && gapMs(cur, next) <= MAX_GAP_MS) {
      merged.push({
        runId: next.runId,
        paths: [cur.path, next.path],
        events: [...cur.events, ...next.events],
      });
      i += 1;
      continue;
    }
    merged.push({ runId: cur.runId, paths: [cur.path], events: cur.events });
  }
  return merged;
}

function endsWithTutorialClear(f: RunFile): boolean {
  for (let i = f.events.length - 1; i >= 0; i--) {
    const b = f.events[i]?.body;
    if (b?.event === 'SessionEnd') return b.result === 'TutorialClear';
  }
  return false;
}

function isTutorial(f: RunFile): boolean {
  const b = f.events.find((e) => e.body.event === 'BattleStart')?.body;
  return b?.event === 'BattleStart' && b.nodeType === 'Tutorial';
}

function startMs(f: RunFile): number {
  return f.events[0]?.date.getTime() ?? Number.POSITIVE_INFINITY;
}

function gapMs(a: RunFile, b: RunFile): number {
  const end = a.events[a.events.length - 1]?.date.getTime();
  const start = b.events[0]?.date.getTime();
  if (end === undefined || start === undefined) return Number.POSITIVE_INFINITY;
  return start - end;
}
