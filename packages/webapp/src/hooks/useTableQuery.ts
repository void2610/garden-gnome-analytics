// URL search に乗せた TableQuery (tf / ts) を取り出して setter を返すフック。
// 各テーブルページから FilterBar 系の events/devices/dateFrom/dateTo と並列で読む。
import { useNavigate } from '@tanstack/react-router';
import { useCallback, useMemo, useState } from 'react';
import type { TableQuery } from '../lib/tableQuery';

interface UrlMode {
  // navigate に渡す `to`。どのルートに属するかが固定なので呼び出し側が明示する。
  to: string;
  // useSearch などで取得した search オブジェクト (tf / ts を含む可能性あり)。
  search: { tf?: TableQuery['tf']; ts?: TableQuery['ts'] };
}

// URL search を介して TableQuery を読み書きする
export function useUrlTableQuery({ to, search }: UrlMode): {
  query: TableQuery;
  setQuery: (next: TableQuery) => void;
} {
  const navigate = useNavigate();

  const query: TableQuery = useMemo(
    () => ({ tf: search.tf, ts: search.ts }),
    [search.tf, search.ts],
  );

  const setQuery = useCallback(
    (next: TableQuery) => {
      navigate({
        to,
        search: ((prev: Record<string, unknown>) => ({
          ...prev,
          tf: next.tf,
          ts: next.ts,
          // biome-ignore lint/suspicious/noExplicitAny: TanStack Router の search 動的型は dynamic
        })) as any,
        replace: true,
      });
    },
    [navigate, to],
  );

  return { query, setQuery };
}

// URL に乗せたくないケース (ネストしたページ / セカンダリテーブル) 用のローカル state 版
export function useLocalTableQuery(initial?: TableQuery): {
  query: TableQuery;
  setQuery: (next: TableQuery) => void;
} {
  const [query, setQuery] = useState<TableQuery>(initial ?? {});
  return { query, setQuery };
}
