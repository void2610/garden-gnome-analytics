# Phase 0: プロジェクト基盤構築

## 目的

以降のすべてのフェーズが乗る土台を作る。pnpm workspaces のモノレポ構造、TypeScript・Biome・Vitest の共通設定、共有スキーマ用パッケージの骨格を整え、「どこに何を置くか」「どう動かすか」をプロジェクト全体で一意に定める。

## ゴール（Definition of Done）

1. `pnpm install` がエラーなく完走する。
2. `packages/shared` `packages/parser` `packages/webapp` の 3 パッケージが pnpm workspaces として認識され、`pnpm -F <pkg> <cmd>` で各々のスクリプトを実行できる。
3. ルートで `pnpm typecheck` `pnpm lint` `pnpm test` が（中身は空でも）正常終了する。
4. Biome の設定がリポジトリ全体に適用され、`pnpm format` で整形できる。
5. `data/` `public-data/` ディレクトリが存在し、`data/` は `.gitignore` 対象（meta.yaml 除く）になっている。
6. `node` 20.x、`pnpm` 9.x が `package.json#engines` に記載されている。

## タスク

### 0.1 ルート構成
- [ ] ルートに `package.json` を作成（`name: garden-gnome-analytics`、`private: true`、`type: module`、`engines.node`、`engines.pnpm`、`packageManager: "pnpm@9.x"`）
- [ ] `pnpm-workspace.yaml` を作成し `packages: ['packages/*']` を登録
- [ ] ルート `tsconfig.base.json` を作成（`strict: true`、`moduleResolution: "Bundler"`、`target: "ES2022"`、`isolatedModules: true`、`verbatimModuleSyntax: true`、`noUncheckedIndexedAccess: true`）
- [ ] ルート `tsconfig.json` で全パッケージへ参照を貼る（`references`）
- [ ] `.editorconfig` を作成（UTF-8 / LF / 2 space / final newline）
- [ ] `.gitattributes` を作成（`* text=auto eol=lf`、`*.parquet binary`）

### 0.2 Biome
- [ ] `biome.json` をルートに作成（`organizeImports.enabled: true`、`linter.rules.recommended: true`、`formatter.indentStyle: "space"`）
- [ ] ルート `package.json` に `lint`/`format`/`format:check` スクリプトを追加
- [ ] `node_modules` `dist` `public-data` `data` を `files.ignore` に追加

### 0.3 共通スクリプト
- [ ] ルート `package.json` に以下を追加
  - `typecheck`: `pnpm -r --parallel typecheck`
  - `test`: `pnpm -r --parallel test`
  - `build`: `pnpm -F @gga/shared build && pnpm -F @gga/parser build && pnpm -F @gga/webapp build`
  - `ingest`: `pnpm -F @gga/parser ingest`
  - `dev`: `pnpm -F @gga/webapp dev`

### 0.4 共有パッケージ `@gga/shared`
- [ ] `packages/shared/package.json` を作成（`name: "@gga/shared"`、`type: module`、`main: dist/index.js`、`types: dist/index.d.ts`、`exports`）
- [ ] `packages/shared/tsconfig.json` を作成（`composite: true`、ルート `tsconfig.base.json` を extend）
- [ ] `packages/shared/src/index.ts` を空で作成（後続フェーズで Zod スキーマを置く）
- [ ] `vitest.config.ts` を作成（最小設定）
- [ ] `typecheck`/`test`/`build` スクリプトを追加

### 0.5 parser パッケージ骨格
- [ ] `packages/parser/package.json` を作成（`name: "@gga/parser"`、`type: module`、`bin: { ingest: "dist/cli/ingest.js" }`）
- [ ] `packages/parser/tsconfig.json` を作成（`composite: true`、`@gga/shared` への path 参照）
- [ ] `packages/parser/src/index.ts`、`src/cli/ingest.ts` を空のスタブで作成
- [ ] devDeps: `tsx`、`tsup`、`vitest`、`@types/node`
- [ ] `dependencies` に `@gga/shared: workspace:*` を追加
- [ ] `dev`/`build`/`typecheck`/`test`/`ingest` スクリプトを追加

### 0.6 webapp パッケージ骨格
- [ ] `pnpm create vite packages/webapp --template react-ts` でひな形生成（生成後 `package.json` の name を `@gga/webapp` に変更）
- [ ] `packages/webapp/tsconfig.json` を `tsconfig.base.json` ベースに置き換え
- [ ] `vite.config.ts` に `base: '/garden-gnome-analytics/'` を設定
- [ ] `dependencies` に `@gga/shared: workspace:*` を追加
- [ ] 不要ファイル（`App.css`、ロゴ画像、デフォルト README）を削除し、`App.tsx` に「Hello GGA」のみ残す
- [ ] `dev`/`build`/`typecheck`/`test`/`preview` スクリプトを確認

### 0.7 データディレクトリ
- [ ] `data/.gitkeep` `public-data/.gitkeep` を作成
- [ ] `.gitignore` に `data/**` を追加（既存のルールが網羅していない場合のみ）し、`!data/**/meta.yaml` `!data/.gitkeep` を例外に
- [ ] `data/` 直下に README を 1 ファイル置き「ここに `<event>/<device>/` の階層で配置」と明記

### 0.8 動作確認
- [ ] `pnpm install` を初回実行
- [ ] `pnpm typecheck` が成功
- [ ] `pnpm lint` が成功
- [ ] `pnpm test` が成功（テストゼロでも 0 件成功扱い）
- [ ] `pnpm dev` で webapp が起動し、ブラウザで「Hello GGA」が表示される
- [ ] コミット: `chore: phase 0 - pnpm workspaces 基盤構築`

## 成果物

```
garden-gnome-analytics/
├── package.json
├── pnpm-workspace.yaml
├── pnpm-lock.yaml
├── tsconfig.base.json
├── tsconfig.json
├── biome.json
├── .editorconfig
├── .gitattributes
├── data/
│   ├── .gitkeep
│   └── README.md
├── public-data/
│   └── .gitkeep
└── packages/
    ├── shared/{package.json, tsconfig.json, src/index.ts, vitest.config.ts}
    ├── parser/{package.json, tsconfig.json, src/{index.ts, cli/ingest.ts}, vitest.config.ts}
    └── webapp/{package.json, tsconfig.json, vite.config.ts, src/{main.tsx, App.tsx}}
```

## 検証方法

```bash
pnpm install
pnpm typecheck   # → exit 0
pnpm lint        # → exit 0
pnpm test        # → exit 0
pnpm dev         # → http://localhost:5173/ が開き「Hello GGA」表示
```

## リスク / 留意点

- **`packageManager` フィールドは pnpm@9 を pin**。corepack 経由のインストール差異を避ける。
- **TypeScript の `composite: true`** を有効にしないと `pnpm -r typecheck` が遅くなる。最初から projet references を組む。
- **`verbatimModuleSyntax`** を入れると `import type` の徹底が必要になるが、後で入れるとリファクタが大きいのでこの段階で固定する。
- **Vite の `base`** をリポジトリ名に揃えないと GitHub Pages デプロイ時にアセット 404 になる。Phase 6 で気付く前に今入れる。

## 次フェーズへの引き継ぎ

- `@gga/shared` が空のまま存在 → Phase 1 でここに Zod スキーマを実装する。
- `@gga/parser/src/cli/ingest.ts` がスタブで存在 → Phase 2 で中身を実装する。
- webapp は Hello 表示のみ → Phase 3 でルーティング・Mantine・DuckDB を載せる。

## 完了メモ

- コミット: `feb90c0`
- 所要: 約 30 分
- 想定外:
  - `composite: true` + `noEmit: true` の組み合わせで参照プロジェクトがエラーになるため、
    project references を撤去し各パッケージの tsconfig を独立化した。
  - Biome 1.9.4 の `linter.rules.style.useImportType` は recommended で警告止まり。
  - `vitest run` は test ファイル 0 件で exit 1 になるため `--passWithNoTests` を付与。
