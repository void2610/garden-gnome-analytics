#!/usr/bin/env node
// Google Sheets のローカライズ CSV を取得して JSON 化し、public-data/ に書き出す
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SHEET_ID = '1XfZ4QDTImbWVPBUldvIIE9XHgcqz1B5-YKfJuBLym6M';
// Key, Japanese(ja), English(en) のシート群
const SHEETS = [
  { gid: '861075628', name: 'cards' },
  { gid: '1067471069', name: 'ui' },
];

interface LocalizationRow {
  key: string;
  ja: string;
  en: string;
}

// 簡易 CSV パーサ (RFC4180 ダブルクォート + 改行を含む値に対応)
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ',') {
        cur.push(field);
        field = '';
      } else if (ch === '\n') {
        cur.push(field);
        rows.push(cur);
        cur = [];
        field = '';
      } else if (ch === '\r') {
        // skip
      } else {
        field += ch;
      }
    }
  }
  if (field.length > 0 || cur.length > 0) {
    cur.push(field);
    rows.push(cur);
  }
  return rows;
}

async function fetchSheet(gid: string): Promise<LocalizationRow[]> {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${gid}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch ${url} failed: ${res.status}`);
  const text = await res.text();
  const rows = parseCsv(text);
  if (rows.length === 0) return [];
  // 1 行目はヘッダ
  return rows
    .slice(1)
    .filter((r) => r[0] && r[0].length > 0)
    .map((r) => ({ key: r[0] ?? '', ja: r[1] ?? '', en: r[2] ?? '' }));
}

// CARD_<英名>_NAME → { 英名: 日本語名 } を抜き出す
function extractCardNames(rows: LocalizationRow[]): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /^CARD_([A-Za-z0-9]+)_NAME$/;
  for (const r of rows) {
    const m = r.key.match(re);
    if (!m) continue;
    const englishKey = m[1];
    if (!englishKey || !r.ja) continue;
    out[englishKey] = r.ja;
  }
  return out;
}

async function main() {
  // このファイル位置から見たリポジトリルート (packages/parser/src/cli/ の 4 つ上)
  const here = dirname(fileURLToPath(import.meta.url));
  const repoRoot = resolve(here, '../../../..');
  // --out 引数で上書き可能
  const outArgIdx = process.argv.indexOf('--out');
  const outDir =
    outArgIdx >= 0 && process.argv[outArgIdx + 1]
      ? resolve(process.argv[outArgIdx + 1] as string)
      : resolve(repoRoot, 'public-data');
  const allRows: Record<string, LocalizationRow[]> = {};
  for (const s of SHEETS) {
    console.log(`fetching ${s.name} (gid=${s.gid})...`);
    allRows[s.name] = await fetchSheet(s.gid);
    console.log(`  → ${allRows[s.name]?.length ?? 0} rows`);
  }

  const cardNames = extractCardNames(allRows.cards ?? []);
  console.log(`extracted ${Object.keys(cardNames).length} card names`);

  const localization = {
    generatedAt: new Date().toISOString(),
    cardNames,
    // 将来用: 全 key→ja のマップも置いておく
    all: Object.fromEntries(
      Object.entries(allRows).flatMap(([, rows]) => rows.map((r) => [r.key, r.ja] as const)),
    ),
  };

  const outPath = resolve(outDir, 'localization.json');
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, JSON.stringify(localization, null, 2), 'utf8');
  console.log(`wrote ${outPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
