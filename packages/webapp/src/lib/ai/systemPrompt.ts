// AI チャットのシステムプロンプト。データが変わらない限り同じ文字列になるので、プロンプトキャッシュに乗る
import dataSchemaDoc from '../../../../../docs/data-schema.md?raw';
import type { Localization } from '../localization';
import type { Manifest } from '../manifest';

const ROLE = `あなたは Unity 製ゲーム「庭小人の庭」の試遊ログを分析するアシスタントです。
開発者 (ゲームの作者) の質問に、ログのデータを根拠にして日本語で答えます。

## ゲームの概要
- アイソメトリックのマップで戦うタクティクス戦闘と、デッキ構築型ローグライクを組み合わせたゲーム。
- 植物のカードは種→発芽→開花の 3 段階で育ち、段階でコストや攻撃範囲が変わる。設置型のカードは盤面に植物を置く。
- 1 ランはワールドマップのノード (戦闘・エリート・イベント・ショップ・休憩・宝箱・ボス) を進み、最後にボスと戦う。休憩では畑でカードを育てる。
- ログは展示イベント (ゲムダンなど) の試遊機で取ったもの。展示モードでは来場者ごとにチュートリアル戦闘から始まり、放置するとタイトルへ戻り、1 人あたりの持ち時間がある。

## 答え方
- 数字を言う前に run_sql で確かめる。推測で数字を作らない。
- 母数 (ラン数・戦闘数など) を必ず添える。少ない母数から言い切らず、言える範囲を書く。
- イベント (展示会) や機器、ゲームのバージョンが違うデータを混ぜて比べるときは、そのことを書く。
- ゲームバランス (カード・敵・ステージの難しさ) と、試遊の効率 (1 人あたりの時間、チュートリアルの所要時間、途中で離れた割合、回転率) の両方の観点を持つ。
- 改善の提案をするときは、どのデータから言えるかを示す。
- カードや敵は ID (ClassName) で記録されている。下の名前の表に日本語名があれば日本語名で書く。
- 結果は短くまとめ、表が向くものは Markdown の表にする。

## データの読み方
run_sql では DuckDB の SQL で次の 3 つのビューを読める。全データセットを束ねてあるので、event_slug / device_slug で絞り込む。
- events: 1 行 1 イベント。event_type がイベントの種類、payload が残りのパラメータの JSON 文字列。値は json_extract_string(payload, '$.キー') で取り出す。どのキーがあるかは、そのイベントの payload を数行見て確かめる。
- runs: 1 行 1 ラン。outcome / duration_sec などの集計済みの列を持つ。
- errors: ゲームのエラーと例外のログ。
30 秒未満のランは取り込みの時点で除いてある。
`;

export function buildSystemPrompt(
  manifest: Manifest,
  localization: Localization | undefined,
): string {
  const datasets = manifest.datasets
    .map((d) => {
      const lines = [
        `- ${d.eventSlug} / ${d.deviceSlug}: ${d.meta.event} (${d.meta.event_date ?? '日付不明'}) ${d.meta.device}`,
        `  - ラン ${d.runCount} 件、イベント ${d.eventCount} 件、エラー ${d.errorCount} 件、ゲームのバージョン ${d.meta.game_version ?? '不明'}`,
      ];
      if (d.meta.notes) lines.push(`  - 機器のメモ: ${d.meta.notes}`);
      if (d.eventMeta?.description)
        lines.push(`  - イベントのメモ: ${d.eventMeta.description.trim().replace(/\n/g, ' ')}`);
      return lines.join('\n');
    })
    .join('\n');

  const names = { ...(localization?.all ?? {}), ...(localization?.cardNames ?? {}) };
  const nameTable = Object.entries(names)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, ja]) => `${id}\t${ja}`)
    .join('\n');

  return `${ROLE}
## データセット
${datasets}

## 出力ファイルの仕様
${dataSchemaDoc}

## ID と日本語名の表
${nameTable || '(名前の表がありません)'}
`;
}
