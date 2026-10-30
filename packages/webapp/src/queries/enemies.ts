// 戦闘中の敵の ID は "アセット名#戦闘内の通し番号"。番号を外してアセット名ごとにまとめる
export function enemyAssetSql(column: string): string {
  return `regexp_replace(${column}, '#[0-9]+$', '')`;
}

// json の payload から文字列を取り出す
export function payloadText(key: string): string {
  return `json_extract_string(payload, '$.${key}')`;
}

// 画面上部の絞り込みの WHERE 句に、イベントの種類の条件を足す
export function whereEvents(where: string, eventTypes: string[]): string {
  const list = eventTypes.map((t) => `'${t}'`).join(', ');
  return `${where ? `${where} AND` : 'WHERE'} event_type IN (${list})`;
}
