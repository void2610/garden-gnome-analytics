// ゲームの原因 (source / cause / killedBy) は "種類:詳細" で書かれる (敵は "Enemy:アセット名#戦闘内の通し番号")。
// 種類と、通し番号を外した詳細に分けて集計する。区切りの無い値 (TurnStart など、旧形式の表示名) は種類だけにする
export function causeKindSql(column: string): string {
  return `CASE WHEN contains(${column}, ':') THEN split_part(${column}, ':', 1) ELSE COALESCE(${column}, 'Unknown') END`;
}

export function causeDetailSql(column: string): string {
  return `CASE WHEN contains(${column}, ':') THEN regexp_replace(split_part(${column}, ':', 2), '#[0-9]+$', '') ELSE '' END`;
}

export const CAUSE_KIND_JA: Record<string, string> = {
  Enemy: '敵',
  Card: 'カード',
  Item: 'アイテム',
  Plant: '植物',
  Status: '状態異常',
  Relic: 'レリック',
  Spawn: '敵の出現',
  TurnStart: 'ターン開始',
  BattleEnd: '戦闘終了',
  Unknown: '不明',
};

export function causeKindLabel(kind: string): string {
  const ja = CAUSE_KIND_JA[kind];
  return ja ? `${ja} (${kind})` : kind;
}
