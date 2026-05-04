// public-data/localization.json を取得し、英名 → 日本語名のマップを提供
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { manifestUrl } from './duckdb/paths';

const LocalizationSchema = z.object({
  generatedAt: z.string(),
  cardNames: z.record(z.string()),
  all: z.record(z.string()).optional(),
});

export type Localization = z.infer<typeof LocalizationSchema>;

function localizationUrl(): string {
  // manifestUrl と同じ base から localization.json を fetch
  return manifestUrl().replace(/manifest\.json$/, 'localization.json');
}

export async function fetchLocalization(): Promise<Localization> {
  const res = await fetch(localizationUrl());
  if (!res.ok) {
    // ファイルが無くても致命傷ではないので空のローカライズを返す
    return { generatedAt: '', cardNames: {} };
  }
  const json = await res.json();
  return LocalizationSchema.parse(json);
}

// React フックで取得（manifest 同様、不変キャッシュ）
export function useLocalization() {
  return useQuery({
    queryKey: ['localization'],
    queryFn: fetchLocalization,
  });
}

// 英名 → 「<日本語名> (<英名>)」形式の表示用ヘルパ
export function localizeCardName(
  englishName: string | null | undefined,
  cardNames: Record<string, string> | undefined,
): string {
  if (!englishName) return '-';
  const ja = cardNames?.[englishName];
  if (!ja) return englishName;
  return `${ja} (${englishName})`;
}

// 日本語名のみ
export function jaCardName(
  englishName: string | null | undefined,
  cardNames: Record<string, string> | undefined,
): string {
  if (!englishName) return '-';
  return cardNames?.[englishName] ?? englishName;
}
