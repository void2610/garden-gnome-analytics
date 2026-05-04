# Phase 3: webapp 基盤構築

## 目的

webapp のフレームワーク・ルーティング・UI ライブラリ・クエリ基盤（DuckDB-Wasm）を「最小限のページが Parquet を SQL で叩いて表示する」状態まで持っていく。Phase 4 以降は、この基盤に**画面と SQL を足すだけ**で進められるようにする。

## ゴール（Definition of Done）

1. `pnpm dev` で起動した webapp が、`public-data/manifest.json` を読み、データセット一覧を画面に表示する。
2. データセットを選ぶと、選択された `events.parquet` に対し DuckDB-Wasm が `SELECT COUNT(*)` を発行し、結果をカードに表示する。
3. ルーティングは TanStack Router で、`/datasets/:slug` のような階層が機能し、選択中データセットが URL に反映される。
4. Mantine v7 のテーマ（ダーク/ライト切替）が機能する。
5. DuckDB-Wasm は **Web Worker で初期化**されており、UI スレッドをブロックしない。
6. `pnpm build` でエラーなく静的ビルドが完成する。
7. `pnpm preview` で本番ビルドをローカル配信し、`base: '/garden-gnome-analytics/'` 配下でも動く。

## タスク

### 3.1 依存追加
- [ ] runtime: `@mantine/core` `@mantine/hooks` `@mantine/notifications` `@mantine/dates` `@mantine/charts` `@mantine/spotlight` `@tanstack/react-router` `@tanstack/react-query` `@duckdb/duckdb-wasm` `@duckdb/duckdb-wasm-shell`（後者は不要なら除外）`zod` `date-fns` `recharts`（@mantine/charts が要求）
- [ ] dev: `@tanstack/router-vite-plugin` `@tanstack/router-devtools` `@tanstack/react-query-devtools` `@types/react` etc.

### 3.2 Mantine セットアップ
- [ ] `src/main.tsx` で `MantineProvider` `Notifications` をラップ
- [ ] `src/theme.ts` を作成（プライマリカラー、フォント、ダークモード初期値）
- [ ] CSS 読み込み: `@mantine/core/styles.css` `@mantine/dates/styles.css` `@mantine/notifications/styles.css`
- [ ] ColorScheme トグルを Header に置く（後続フェーズの土台）

### 3.3 TanStack Router セットアップ
- [ ] `vite.config.ts` に `@tanstack/router-vite-plugin` を追加（自動ルート生成）
- [ ] `src/routes/__root.tsx`: 共通レイアウト（AppShell: Header + Sidebar + Content）
- [ ] `src/routes/index.tsx`: トップページ（データセット一覧）
- [ ] `src/routes/datasets/$slug.tsx`: 単一データセットの skeleton 画面
- [ ] `validateSearch` で URL search params を Zod に通すサンプルを 1 つ実装
- [ ] DevTools をルーターに登録

### 3.4 TanStack Query セットアップ
- [ ] `src/lib/queryClient.ts`: `staleTime: Infinity`（Parquet は不変なので積極キャッシュ）
- [ ] `QueryClientProvider` で全体ラップ
- [ ] DevTools 登録

### 3.5 DuckDB-Wasm 初期化
- [ ] `src/lib/duckdb/worker.ts`: `@duckdb/duckdb-wasm` の eh worker をインポート
- [ ] `src/lib/duckdb/client.ts`: シングルトン `getDb(): Promise<AsyncDuckDB>`
  - `selectBundle()` で適切な bundle を選択（cdn 配信は使わずローカル bundle）
  - `Worker` URL は `import.meta.url` 経由で Vite に解決させる
  - `db.instantiate(...)`、`db.open({ query: { castBigIntToDouble: true } })`
- [ ] `src/lib/duckdb/query.ts`: `query<T>(sql: string, params?: any[]): Promise<T[]>` ヘルパ
  - `db.connect()` → `prepare()` → `query()` → `disconnect()`
  - 結果を `JSON.parse(JSON.stringify(...))` ではなく Arrow→object 変換で返す
- [ ] `src/lib/duckdb/registerHttpfs.ts`: 起動時に `INSTALL httpfs; LOAD httpfs;`

### 3.6 Manifest 読み込み
- [ ] `src/lib/manifest.ts`: `fetchManifest(): Promise<Manifest>`
  - `fetch(import.meta.env.BASE_URL + 'data/manifest.json')` を使う
  - Zod で検証してから返す
- [ ] `useManifest()` フック（TanStack Query）を作成

### 3.7 Parquet パス解決
- [ ] `src/lib/duckdb/paths.ts`: `eventsParquetPath(eventSlug, deviceSlug)` を返す関数
  - 開発時: `'/data/events/event=.../device=.../data.parquet'` (vite serve がそのまま返す)
  - 本番: 相対 URL、DuckDB-Wasm の httpfs で取得
- [ ] webapp ビルド時に `public-data/` を `public/data/` にコピーする npm スクリプト（`prebuild` で実行）を追加。または vite の `publicDir` を `public-data` に向ける（推奨）。
- [ ] CORS / Range request 対応の確認: GitHub Pages は両方 OK

### 3.8 動作確認用 UI
- [ ] `/`: Manifest からデータセット一覧をカード列で表示（Mantine の `SimpleGrid` + `Card`）
- [ ] カードをクリックで `/datasets/$slug` へ遷移
- [ ] `/datasets/$slug`: `SELECT COUNT(*) FROM '<events.parquet>'` をクエリ、結果を `Stat` 風カードで表示
- [ ] エラー時の Notification 表示

### 3.9 共通レイアウト
- [ ] `<AppShell header sidebar>` で土台
- [ ] Header: タイトル、ColorScheme トグル、Spotlight 起動ボタン（中身は Phase 5）
- [ ] Sidebar: 主要メニューのスタブ（Dashboard / Runs / Cards / Stages / Errors / Search）
- [ ] フッター: ビルド時刻と manifest の `generatedAt` を表示

### 3.10 ビルド / プレビュー検証
- [ ] `pnpm -F @gga/webapp build` 成功
- [ ] `pnpm -F @gga/webapp preview` で `http://localhost:4173/garden-gnome-analytics/` を開いて動作確認
- [ ] Lighthouse (任意): Performance 80+ を目安に確認

## 成果物

```
packages/webapp/src/
  main.tsx
  theme.ts
  routes/
    __root.tsx
    index.tsx
    datasets/$slug.tsx
  lib/
    queryClient.ts
    manifest.ts
    duckdb/{worker.ts, client.ts, query.ts, paths.ts, registerHttpfs.ts}
  components/
    AppHeader.tsx
    AppSidebar.tsx
    DatasetCard.tsx
  hooks/
    useManifest.ts
    useEventCount.ts (例)
```

## 検証方法

```bash
pnpm dev
# /              -> データセット一覧表示
# /datasets/<slug> -> COUNT(*) が表示

pnpm build && pnpm -F @gga/webapp preview
# /garden-gnome-analytics/ で同じ画面が見える
```

ブラウザ DevTools の Network タブで:
- `manifest.json` が 200 で返る
- Parquet ファイルが Range request（`Range: bytes=...`）で部分取得されている

## リスク / 留意点

- **DuckDB-Wasm の Worker URL**: Vite 4/5 は `new URL('worker.js', import.meta.url)` で解決するが、`@duckdb/duckdb-wasm` の bundles は内部で `Worker` URL を要求する。公式 example の `selectBundle` パターンを踏襲する（自前で URL を組み立てない）。
- **wasm 初期化の遅延**: 約 1〜2 秒。初回読み込み中は Skeleton/Loader を出す。
- **httpfs の Range Request 対応**: `vite preview` は対応する。GitHub Pages も対応する。任意の中間 CDN を挟むときは要確認。
- **`publicDir` を `public-data` に向ける**: vite はそのまま root に配置するため、相対パス `data/...` ではなく `<event=...>/...` のままになる。`publicDir: 'public-data'` + 出力先 `data/` を分ける構成は混乱しがちなので、**ビルド前コピー**（`scripts/copy-public-data.mjs`）を採用する方が単純。
- **BigInt**: DuckDB の COUNT は BIGINT で返る。`castBigIntToDouble: true` か明示 `CAST` を使う。
- **AsyncDuckDB の disconnect**: connection を漏らすと wasm メモリが膨らむ。`query` ヘルパで try/finally 必須。

## 次フェーズへの引き継ぎ

- 「ページを 1 つ追加 = ルートを足して `useQuery(query(<SQL>))` を書く」だけで実装が進む状態を担保。
- すべての SQL は `src/queries/` 配下に集約する規約を Phase 4 で導入する。
- フィルタ状態は URL search params に置く方針も Phase 4 で具体化。

## 完了メモ

- コミット: `d9507ad`
- 所要: 約 40 分
- 想定外:
  - TanStack Router は code-based ルーティング（`@tanstack/router-plugin` 不使用）で実装。
  - Vite の `publicDir` をワークスペースルートの `public-data/` に向けることで
    開発時もそのまま `/<base>/events/...` が解決される。
  - DuckDB-Wasm の Worker URL は CORS 回避のため `Blob` URL でラップ。
  - `Link to="/datasets/$slug"` の動的 params 推論が router 循環で型エラーになったため、
    `as any` でキャストして回避（実害なし）。
