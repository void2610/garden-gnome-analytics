# 設計ドキュメント（初版・検討用）

## 0. 前提となるログ仕様（実ファイル調査結果）

### (a) 通常ログ `the-garden-of-garden-gnome_<YYYYMMDD>_<HHMMSS>.log`
```
2026-05-03 10:33:47.782 [LogManager] Initialized
2026-05-03 10:34:03.189 [Error] Failed to update rich presence -
2026-05-03 11:09:28.855 [Log] カードモード切替入力を受信
2026-05-03 10:47:56.069 [Exception] NullReferenceException: ...
  <スタックトレース複数行>
```
- レベル: `[Log]` / `[Error]` / `[Exception]` / `[LogManager]`
- 時刻: `YYYY-MM-DD HH:MM:SS.fff`（ローカル時刻）
- `[AnalyticsLogger] ランログ開始: <path>` で run ログとの対応が取れる

### (b) ラン解析ログ `run_<YYYYMMDD>_<HHMMSS>_<ms>.log`
```
2026-05-03T11:23:37.468|SessionStart
2026-05-03T11:23:43.347|BattleStart|stageId=Layer0_0_Battle|enemyCount=2|deckCards=Fraxinus(Seed);Olive(Seed);...
2026-05-03T11:24:33.423|PlayerMoved|from=7,7|to=7,6|moveDistance=1|remainingMovePoints=3
```
- 1 行 1 イベント、`|` 区切り、`key=value` 形式
- リスト値は `;` 区切り（例: `deckCards`、`handCardNames`、`choices`）
- 観測されたイベント種別（21 種）:
  `SessionStart` / `SessionEnd` / `StageEnter` / `BattleStart` / `BattleWin` /
  `TurnStart` / `TurnEnd` / `PlayerMoved` / `PlayerHealthChanged` / `PlayerDamaged` /
  `CardPlayed` / `CardCancelled` / `CardPlayFailed` / `PlantPlaced` /
  `EnemyDefeated` / `RewardSelected` / `ShopBuy` / `ShopExit` /
  `RestChoice` / `TreasureCollected` / `StageEventSelected` / `CultivationResult`

---

## 1. ディレクトリ構成案

```
garden-gnome-analytics/
├── README.md
├── docs/
│   └── design.md
├── data/                              # 生ログ置き場（.gitignore で除外）
│   └── <event>/                       # 例: gemudan12_demo_2026-05/
│       └── <device>/                  # 例: macbookpro/  steamdeck/
│           ├── meta.yaml              # ← これだけ git 管理
│           ├── run_*.log              # (b) ラン解析ログ
│           └── the-garden-of-garden-gnome_*.log  # (a) 通常ログ
├── packages/
│   ├── parser/                        # ログ→正規化 JSONL/Parquet 変換
│   │   ├── src/
│   │   │   ├── runLogParser.ts        # (b) のパーサ
│   │   │   ├── normalLogParser.ts     # (a) のパーサ
│   │   │   ├── correlator.ts          # (a)(b) を時刻で突合
│   │   │   ├── ingest.ts              # CLI エントリ
│   │   │   └── schema.ts              # 共通型定義
│   │   └── package.json
│   └── webapp/                        # 静的 SPA（ブラウザ単体で動く）
│       ├── src/
│       │   ├── pages/                 # Dashboard / Runs / Cards / Stages / Errors / Search
│       │   ├── components/            # チャート、フィルタ、ヒートマップ
│       │   ├── lib/duckdb.ts          # DuckDB-Wasm 初期化＋クエリ
│       │   └── main.tsx
│       ├── public/                    # 取り込み済み Parquet/JSONL の配置場所
│       └── package.json
├── public-data/                       # webapp が fetch する正規化データ
│   ├── manifest.json                  # データセット一覧（event/device/version）
│   ├── events.parquet                 # 全 run ログを縦持ちで統合
│   ├── runs.parquet                   # ラン単位サマリ
│   └── errors.parquet                 # 通常ログから抽出したエラー
├── package.json                       # pnpm workspaces / npm workspaces
├── tsconfig.json
└── .gitignore
```

**設計意図**
- `data/` と `public-data/` を分離。前者は生ログ（巨大）、後者は parser 出力（コミット可・GitHub Pages 配信可）。
- 取り込みは事前バッチ（CLI）。Web アプリは静的アセットを fetch するだけ → サーバ不要。
- `meta.yaml` でイベント・機器・ゲームバージョン・来場者属性などを記述し、ingest 時に各イベント行へタグ付け。

`meta.yaml` の例:
```yaml
event: ゲムダン12 デモ展示
event_date: 2026-05-03
venue: 〇〇会場
device: MacBook Pro 14" M3
game_version: 0.2.x
notes: 来場者層は学生中心。コントローラはキーボード+マウス。
```

---

## 2. 技術スタック

詳細な比較・採否判断は [tech-stack.md](tech-stack.md) を参照。最終採用案のみここに転記:

```
言語         : TypeScript 5.x
モノレポ     : pnpm workspaces
共通         : Zod, date-fns, Vitest, Biome

[parser]
  Node 20 + tsx / tsup
  fast-glob, yaml, pino, duckdb (Node bindings)
  → Parquet (zstd) を public-data/ に出力

[webapp]
  Vite 5 + React 19 + TypeScript
  TanStack Router (search params に Zod)
  TanStack Query
  DuckDB-Wasm (Web Worker)
  Mantine v7 (+ Mantine React Table, @mantine/charts)
  Observable Plot (主力チャート)
  ECharts for React (heatmap など重い描画)

[CI/CD]
  GitHub Actions
  GitHub Pages (actions/deploy-pages)
  生ログは Git LFS（必要に応じて有効化）
```

---

## 3. 機能案（優先度つき）

### P0（最初に作るコア機能）
1. **ログ取り込み CLI**
   `pnpm ingest data/<event>/<device>/` で run + 通常ログを読み、`public-data/*.parquet` を生成。`meta.yaml` の値を各行へ付与。
2. **概要ダッシュボード**
   - 期間・イベント・機器でフィルタ
   - 総ラン数 / 中央プレイ時間 / 平均到達ステージ / 勝率
   - 時間帯別プレイ数（展示中の混雑可視化）
3. **ラン一覧 → ラン詳細**
   - 一覧: 開始時刻、長さ、最終ステージ、勝敗、最終 HP、デッキサイズ
   - 詳細: タイムラインビュー（イベント順）、HP 推移、デッキ進化、関連する通常ログのエラー抽出
4. **カード分析**
   - 使用回数ランキング（cardName × growthStage）
   - リワード選択率 = `RewardSelected` の `selected` ÷ `choices` 出現回数
   - ラン勝敗別の使用率差分（負けランで多用されるカード = バランス見直し候補）

### P1（次に作る）
5. **バトル/ステージ分析**
   - ステージ別到達率、勝率、平均ターン数、平均被ダメ
   - 撃破した敵分布（`EnemyDefeated.enemyName`）
6. **マップヒートマップ**
   - `PlayerMoved` の `to` 座標を集計して 16×16 グリッド上に可視化
   - `PlantPlaced` の配置ヒートマップを別レイヤで重畳
7. **エラー連動ビュー**
   - 通常ログ `[Error]`/`[Exception]` を抽出し、時刻で run と突合
   - 「プレイ中に例外が出たラン」をフラグ表示
8. **横断検索**
   - 自由文検索（カード名、ステージ ID、敵名、エラー文言）

### P2（余力があれば）
9. **イベント／機器比較ビュー**
   - メタデータ別に並べて差分（例: SteamDeck vs MacBookPro でカード使用率に差があるか）
10. **CSV/JSON エクスポート**
    - 絞り込んだ結果のダウンロード
11. **再生プレビュー**
    - run ログを時系列で「再生」して、ある時点のデッキ／HP／座標を表示

---

## 4. 未確定事項（ユーザー判断が必要）

- **リポジトリ名**: 仮で `garden-gnome-analytics` とした。変更希望があれば差し替え。
- **GitHub への push**: ローカル init のみ実施。リモート作成・push は未実施（指示があれば対応）。
- **ログの owner ディレクトリ**: 現状の `data/<event>/<device>/` 構成で良いか。例えば `data/<event>/<device>/<session>/` まで切るかは要相談。
- **A 案 / B 案**: 個人専用か他者共有かで答えが変わる。デフォルトは A 案で進める想定。
- **デッキ進化の追跡精度**: `BattleStart.deckCards` は前後比較できるが、`RewardSelected` から構築するべきか、全 BattleStart のスナップショットを保持するかは実装方針による。
