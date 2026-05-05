# Garden Gnome Analytics

[the-garden-of-garden-gnome](https://github.com/Void2610/the-garden-of-garden-gnome) のプレイログを分析するための静的 SPA。

イベント展示で収集した生ログを正規化して Parquet 化し、ブラウザ上の DuckDB-Wasm で集計・可視化する。

## 機能

- ダッシュボード（総ラン数 / 中央プレイ時間 / 平均到達ステージ / 勝率 / 時間帯・日別プレイ数）
- ラン一覧 / ラン詳細（タイムライン・HP 推移・関連エラー）
- カード分析（使用回数 / リワード選択率 / 勝敗別差分）
- ステージ分析（到達数・勝率・平均ターン数）
- マップヒートマップ（移動 / 配置）
- エラー集計
- 比較ビュー（複数データセットの並列比較）
- イベント・機器・期間でのフィルタ（URL search params に永続化）

## クイックスタート

```bash
# 1. 依存インストール
pnpm install

# 2. 生ログを配置
mkdir -p data/<event-slug>/<device-slug>
# meta.yaml を作成
# run_*.log と the-garden-of-garden-gnome_*.log をコピー

# 3. 取り込み (Parquet 生成)
pnpm ingest --clean

# 4. webapp 起動
pnpm dev
# → http://localhost:5173/garden-gnome-analytics/
```

`meta.yaml` (機器単位、必須) の例:

```yaml
event: ゲムダン12 デモ展示
event_date: 2026-05-03
venue: ゲムダン12 会場
device: MacBook Pro 14"
game_version: 0.2.x
notes: 学生中心の客層
```

任意でイベント単位の `data/<event>/event.yaml` を置くと、説明文や開催時間帯
(`play_hours`) を指定できる。時間帯外のランは ingest 時に除外される。
全イベント共通のエラー除外パターンは `config/exclude_errors.yaml` に書く。
詳細は [`docs/event-config.md`](docs/event-config.md) を参照。

## モノレポ構成

```
packages/
├── shared/   # @gga/shared: Zod スキーマ・共通型
├── parser/   # @gga/parser: ログパーサと ingest CLI
└── webapp/   # @gga/webapp: Vite + React + DuckDB-Wasm の SPA
```

## 主なスクリプト

| コマンド | 内容 |
| --- | --- |
| `pnpm dev` | webapp を開発モードで起動 |
| `pnpm ingest` | `data/` を走査して `public-data/` を生成 |
| `pnpm fetch-localization` | Google Sheets からカード/UI の日本語名を取得 |
| `pnpm test` | 全パッケージの Vitest を実行 |
| `pnpm typecheck` | tsc --noEmit |
| `pnpm lint` | Biome lint |
| `pnpm format` | Biome format --write |
| `pnpm build` | 全パッケージビルド |

## 技術スタック

- TypeScript 5 / pnpm workspaces / Biome / Vitest
- parser: Node 20 + tsx, fast-glob, yaml, pino, `@duckdb/node-api`
- webapp: Vite 5, React 19, Mantine v7, TanStack Router/Query, `@duckdb/duckdb-wasm`

詳細は [`docs/tech-stack.md`](docs/tech-stack.md) を参照。

## デプロイ

`main` への push で GitHub Actions が GitHub Pages にデプロイする。
公開 URL: <https://void2610.github.io/garden-gnome-analytics/>

データ更新フロー:

1. `data/` に生ログ追加
2. `pnpm ingest` でローカル生成
3. `public-data/` の差分をコミット & push
4. Actions が build → Pages 反映

## ドキュメント

- [`docs/design.md`](docs/design.md) — 全体設計
- [`docs/tech-stack.md`](docs/tech-stack.md) — 技術スタック比較
- [`docs/log-spec.md`](docs/log-spec.md) — ログフォーマット
- [`docs/data-schema.md`](docs/data-schema.md) — Parquet / manifest 出力仕様
- [`docs/data-policy.md`](docs/data-policy.md) — 生ログ・生成物の取り扱い方針
- [`docs/event-config.md`](docs/event-config.md) — `meta.yaml` / `event.yaml` / `exclude_errors.yaml` の書式
- [`docs/plan/`](docs/plan/) — フェーズ別実装計画 (実装履歴)
