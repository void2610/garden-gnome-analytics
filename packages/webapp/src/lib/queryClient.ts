import { QueryClient } from '@tanstack/react-query';

// Parquet は不変なので積極キャッシュ
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: Number.POSITIVE_INFINITY,
      gcTime: 1000 * 60 * 60,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
