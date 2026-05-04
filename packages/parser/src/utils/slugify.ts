// 文字列を URL/パス安全な slug に変換する
// ASCII の英数字とハイフンに正規化、それ以外は - に置換、連続する - を 1 つに、両端をトリム

export function slugify(input: string): string {
  const lower = input.toLowerCase().trim();
  // 全角→半角を簡易対応するため Unicode 正規化
  const nfkd = lower.normalize('NFKD');
  // ASCII 英数字以外を '-' に置換
  const replaced = nfkd.replace(/[^a-z0-9]+/g, '-');
  // 連続する - を 1 つに、両端の - を削除
  return replaced.replace(/-+/g, '-').replace(/^-|-$/g, '');
}
