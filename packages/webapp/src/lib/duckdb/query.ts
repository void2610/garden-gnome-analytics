// DuckDB-Wasm の薄いクエリヘルパ
import { getDb } from './client';

// BigInt を含む結果を JSON 化しやすい数値に丸める
function normalize(value: unknown): unknown {
  if (typeof value === 'bigint') {
    if (value <= BigInt(Number.MAX_SAFE_INTEGER) && value >= BigInt(Number.MIN_SAFE_INTEGER)) {
      return Number(value);
    }
    return value.toString();
  }
  if (value instanceof Date) return value;
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = normalize(v);
    return out;
  }
  return value;
}

export async function query<T = Record<string, unknown>>(sql: string): Promise<T[]> {
  const db = await getDb();
  const conn = await db.connect();
  try {
    const result = await conn.query(sql);
    const rows = result.toArray().map((r) => r.toJSON()) as Record<string, unknown>[];
    return rows.map(normalize) as T[];
  } finally {
    await conn.close();
  }
}
