# Phase 4: P0 コア可視化機能

## 目的

`docs/design.md` の機能案 P0（概要ダッシュボード／ラン一覧・詳細／カード分析／フィルタ UI）を実装し、**この時点で「展示の振り返りに使える」最小限のツールが完成**している状態にする。Phase 5 以降は分析の深掘り、Phase 6 は配布、Phase 7 は仕上げ。

## ゴール（Definition of Done）

1. 4 つのページが完成・動作する: `/dashboard` `/runs` `/runs/$runId` `/cards`。
2. 共通フィルタバー（イベント／機器／期間）の状態が URL search params に乗り、リロードしても保持される。
3. すべての画面でフィルタ変更が**即座に**反映される（クエリは TanStack Query でキャッシュ）。
4. ダッシュボードに、`総ラン数 / 中央プレイ時間 / 平均到達ステージ / 勝率 / 時間帯別プレイ数` が表示される。
5. ラン一覧でソート・ページング・行クリックでの詳細遷移が動作する。
6. ラン詳細でタイムライン・HP 推移・デッキ進化が表示される。
7. カード分析画面で、使用回数ランキング・リワード選択率・勝敗別使用率差分が表示される。
8. 全 SQL が `src/queries/` に集約されており、コンポーネントは `useXxxQuery()` フック経由でしか SQL を呼ばない。
9. 主要な集計純関数に Vitest 単体テストがある（SQL は除外、変換ロジックのみ対象）。

## タスク

### 4.1 共通: クエリ規約
- [ ] `src/queries/` ディレクトリ作成
- [ ] `src/queries/types.ts`: 共通型（Filter, RunRow, CardStat, etc.）を定義
- [ ] `src/queries/runners.ts`: フィルタを受け取って WHERE 句を組み立てる軽い builder
  - SQL インジェクション対策: フィルタは prepared parameters で渡す
- [ ] 各クエリは `(filter: Filter, db: AsyncDuckDB) => Promise<T[]>` のシグネチャに統一

### 4.2 共通: フィルタ
- [ ] `src/components/FilterBar.tsx`
  - イベント MultiSelect（manifest から候補生成）
  - 機器 MultiSelect
  - 期間 DatePickerInput（from/to）
  - 結果（マッチしたラン数）の即時表示
- [ ] `src/lib/filter.ts`: `FilterSchema` を Zod で定義
- [ ] TanStack Router の `validateSearch: zodValidator(FilterSchema)` でルートに紐付け
- [ ] `useFilter()` フック: 現在のルートの search を返す
- [ ] `useUpdateFilter()` フック: search を更新して replace で URL 書き換え

### 4.3 ダッシュボード（`/dashboard`）
- [ ] レイアウト: 上部 KPI カード 4 枚 + 下部チャート 2 枚
- [ ] KPI: 総ラン数、中央プレイ時間（min）、平均到達ステージ、勝率
- [ ] クエリ:
  - `summaryStats(filter)`: 4 つの KPI を 1 クエリで取得
  - `playsByHour(filter)`: 時間帯別プレイ数
  - `playsByDay(filter)`: 日別プレイ数（複数日にまたがる展示用）
- [ ] チャート: Observable Plot
  - 時間帯ヒストグラム（24 列の barY）
  - 日別折れ線
- [ ] ローディング Skeleton と空状態（ヒットなし）の表示
- [ ] レスポンシブ（モバイル幅対応は最小限）

### 4.4 ラン一覧（`/runs`）
- [ ] Mantine React Table で実装
- [ ] 列: 開始時刻 / イベント / 機器 / 期間 / 最終ステージ / 勝敗 / 最終 HP / デッキサイズ / 操作
- [ ] サーバサイド風ソート（DuckDB に ORDER BY を投げる）
- [ ] ページング: 100 件/ページ
- [ ] 行クリック → `/runs/$runId` へ遷移
- [ ] クエリ: `runsList(filter, sort, page)`

### 4.5 ラン詳細（`/runs/$runId`）
- [ ] レイアウト: 上部にラン基本情報、タブで「タイムライン」「HP/コスト推移」「デッキ進化」「関連エラー」
- [ ] 基本情報: 開始時刻、機器、ゲームバージョン、最終結果、所要時間
- [ ] **タイムライン**: イベント順の `<Timeline>`（Mantine）
  - イベント種別ごとにアイコン・色分け
  - 仮想スクロール（react-window）で 1 ラン数百〜数千行に耐える
- [ ] **HP/コスト推移**: Plot.lineY で turn 番号 vs hp / cost / block
- [ ] **デッキ進化**: 各 BattleStart の deckCards をスタックエリアチャートで（カード種ごとの枚数推移）
- [ ] **関連エラー**: errors.parquet から `run_id == $runId` で抽出
- [ ] クエリ:
  - `runDetail(runId)`: 基本情報 1 行
  - `runEvents(runId)`: そのランの events 全件
  - `runErrors(runId)`: 関連エラー
  - `runDeckHistory(runId)`: BattleStart イベントの deckCards を抽出して時系列化

### 4.6 カード分析（`/cards`）
- [ ] レイアウト: 3 つのセクションをタブまたは縦スタックで
- [ ] **使用回数ランキング**: テーブル + barX チャート
  - 列: cardName / growthStage / 使用回数 / 出現ラン数 / 1 ラン平均使用回数
- [ ] **リワード選択率**: 各カードの「choices に含まれた回数」と「selected になった回数」の比率
  - WITH CTE で choices を unnest（`string_split(choices, ';')`）
- [ ] **勝敗別使用差分**: ラン勝敗で結合し、勝ちラン平均と負けラン平均の差を表示
- [ ] クエリ:
  - `cardUsage(filter)`
  - `cardPickRate(filter)`
  - `cardOutcomeDiff(filter)`
- [ ] 純関数（差分計算など）は src/lib/analytics に切り出して Vitest テスト

### 4.7 共通機能
- [ ] エラーバウンダリ（`<ErrorBoundary>`）でクエリ失敗をキャッチし、Notification 表示
- [ ] 空状態コンポーネント `<EmptyState>` を共通化
- [ ] ローディングは `<Skeleton>` と `<Loader>` の使い分けを明文化
- [ ] サイドバー（Phase 3 で stub だったメニュー）から各画面へリンク

### 4.8 アクセシビリティ・i18n
- [ ] 日本語表記を既定とし、表示文字列は `src/i18n/ja.ts` に集約（後の英語化を見据え）
- [ ] 数値表記: 千区切り、小数 2 桁などのフォーマッタを util に集約

### 4.9 仕上げ
- [ ] 各画面のスクリーンショットを `docs/screenshots/` に置く（README で参照）
- [ ] パフォーマンス: 1 万行レベルの events.parquet で各クエリが 200ms 未満
- [ ] BigInt や Date のシリアライズ由来のエラーがないか目視確認

## 成果物

```
packages/webapp/src/
  routes/
    dashboard.tsx
    runs/index.tsx
    runs/$runId.tsx
    cards.tsx
  components/
    FilterBar.tsx
    KpiCard.tsx
    EmptyState.tsx
    RunTimeline.tsx
    DeckHistoryChart.tsx
    HpChart.tsx
  queries/
    summaryStats.ts
    playsByHour.ts
    playsByDay.ts
    runsList.ts
    runDetail.ts
    runEvents.ts
    runErrors.ts
    runDeckHistory.ts
    cardUsage.ts
    cardPickRate.ts
    cardOutcomeDiff.ts
    types.ts
    runners.ts
  hooks/
    useFilter.ts
    useUpdateFilter.ts
  lib/
    filter.ts
    analytics/{cardOutcomeDiff.ts, deckSnapshot.ts, ...}
  i18n/ja.ts
```

## 検証方法

実データを `data/` に置いた状態で:

```bash
pnpm dev
# /dashboard で KPI 表示
# /runs で一覧、ソートとページング動作
# /runs/<id> で詳細表示、タブが切り替わる
# /cards でランキング・選択率・勝敗別差分が表示される
# フィルタを変えると URL が変わり、リロードしても状態保持

pnpm test
pnpm typecheck
```

ストレステスト:
```bash
# 同じ run を 100 倍に複製した data/ で動作確認
pnpm ingest --data-dir data-stress
pnpm dev
# クエリのレスポンスタイムを DevTools のパフォーマンスで確認
```

## リスク / 留意点

- **deckCards の SQL 展開**: `string_split(deckCards, ';')` を unnest して COUNT(*) する処理が頻発する。VIEW で抽象化するか、Phase 2 の取り込み段階で展開した別テーブルを持つかは要判断。最初は VIEW で進める。
- **タイムラインの行数**: 数百行ならそのまま、数千行で重くなる。仮想スクロールが必須。
- **MRT (Mantine React Table) のサイズ**: ライブラリが大きい。bundle が肥大したら TanStack Table 直接へ移行する余地を残す。
- **URL の長さ**: フィルタ複数選択で URL が長くなる。配列はカンマ区切り＋slugify で短縮。
- **DuckDB-Wasm のメモリ**: 全 events.parquet を毎クエリで読むと帯域もかかる。`CREATE VIEW events AS SELECT * FROM read_parquet('public-data/events/**/*.parquet')` を起動時に貼っておく（ファイル自体はキャッシュされる）。
- **タイムゾーン**: ログ時刻はローカル。webapp 側でも `format` をそのまま JST 想定で書く（後で異なる地域で展示されたら見直す）。

## 次フェーズへの引き継ぎ

- 共通フィルタとクエリ規約が確立 → Phase 5 のヒートマップ／検索／エラー連動はこの上に実装。
- ラン詳細の関連エラー欄は、Phase 5 の「エラー連動ビュー」と画面を共有することになる。
- このフェーズの完了時点で「最低限の社内/個人レビュー」が可能。Phase 6（CI/CD）と並走させて公開準備に入って良い。

## 完了メモ

- コミット: `d9507ad`（Phase 3-5 とまとめて）
- 所要: Phase 3-5 まとめて 約 30 分
- 想定外:
  - チャートは Mantine Charts (Recharts wrapper) で十分要件を満たせたため Observable Plot は導入見送り。
  - Mantine React Table は導入せず、`@mantine/core` の `Table` を直接使う構成にした
    （ソート・ページングは実装簡素化のため省略、ORDER BY と LIMIT 500 で運用）。
