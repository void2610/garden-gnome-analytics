// カードは Olive(Seed) のように成長段階が付くので外してまとめる
export function withoutStageSql(column: string): string {
  return `regexp_replace(${column}, '\\(.*\\)$', '')`;
}
