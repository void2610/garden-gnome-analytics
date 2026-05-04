# Phase 6: CI/CD とデプロイ

## 目的

リポジトリへの push をトリガに自動でビルド・テスト・型チェック・デプロイが走り、`https://void2610.github.io/garden-gnome-analytics/` で公開される状態にする。生ログの取り扱いポリシーをこのフェーズで確定する。

## ゴール（Definition of Done）

1. `main` への push で GitHub Actions が起動し、`lint → typecheck → test → ingest → build → deploy` が直列で走る。
2. デプロイ先 GitHub Pages の URL でサイトが表示され、Phase 4/5 の機能が本番でも動く。
3. PR では `lint → typecheck → test` のみが走り、デプロイはしない。
4. 生ログ取り扱いの方針が `docs/data-policy.md` に明文化されている。
5. CI のキャッシュ（pnpm store、duckdb prebuilt）が効き、平均的な実行時間が 5 分以下。
6. README のバッジ（CI 状態、Pages リンク）が更新されている。

## タスク

### 6.1 生ログ／生成物の運用ポリシー決定
- [ ] `docs/data-policy.md` に下記を明文化:
  - 生ログ（`data/`）はコミット**しない**（gitignore 維持）
  - 正規化済み Parquet（`public-data/`）は**コミットする**
    - 理由: webapp が直接 fetch する／サイズが妥当（数 MB）／差分レビュー可
    - 例外: 100MB を超えたら Git LFS、または Releases assets 化
  - 個人情報（ユーザー名・パス）はパース時に除去または匿名化
- [ ] `data/<event>/<device>/meta.yaml` のみ git に乗せる方針を再確認

### 6.2 CI ワークフロー: PR 検証
- [ ] `.github/workflows/ci.yml`
  - トリガ: `pull_request` `push` (`branches-ignore: main`)
  - jobs:
    - `setup`: pnpm install with cache
    - `lint`: `pnpm lint`
    - `typecheck`: `pnpm typecheck`
    - `test`: `pnpm test`
  - matrix は不要（Node 20 単一）
- [ ] 失敗時にアノテーション（Biome / tsc / Vitest の出力）が PR で見える

### 6.3 CI ワークフロー: main デプロイ
- [ ] `.github/workflows/deploy.yml`
  - トリガ: `push` to `main`、`workflow_dispatch`
  - jobs:
    - `build`:
      - pnpm install
      - `pnpm test`
      - `pnpm ingest`（生成 Parquet を artifact に）
        - 生ログを CI で持たない方針の場合、`public-data/` がリポジトリにコミット済み前提で **ingest をスキップ**するモード（後述）
      - `pnpm -F @gga/webapp build`
      - `actions/upload-pages-artifact@v3` で `packages/webapp/dist` をアップロード
    - `deploy`:
      - `actions/deploy-pages@v4`
- [ ] permissions: `pages: write` `id-token: write`
- [ ] concurrency: `group: pages` `cancel-in-progress: true`

### 6.4 ingest の運用モード切替
- [ ] 2 つの運用モードを CLI に追加
  - **A. ローカル ingest → public-data コミット → CI は webapp build のみ**（既定）
  - **B. 生ログを別ストレージから取得して CI で ingest**（将来オプション）
- [ ] 既定は A。CI では `pnpm -F @gga/webapp build` のみ。生 Parquet は事前にコミットされている前提。
- [ ] `pnpm ingest --check`: 既存 Parquet と meta の整合チェック（CI で hash 比較）

### 6.5 環境変数 / シークレット
- [ ] 必要なシークレットなし（GitHub Pages は自動）。明文化のため `.github/README.md`（または ci.yml のコメント）に「シークレット不要」と記載。

### 6.6 Pages 設定
- [ ] GitHub リポジトリ Settings > Pages で **Source: GitHub Actions** に設定
- [ ] Pages の URL を README に記載
- [ ] CNAME / カスタムドメインは現時点で不要

### 6.7 vite ビルドの最終調整
- [ ] `base: '/garden-gnome-analytics/'` の固定（環境変数で切替可能に）
- [ ] `build.sourcemap: true`（数 MB 以内）
- [ ] DuckDB-Wasm の wasm/worker アセットがビルドに含まれることを確認
- [ ] 404 ページ（SPA fallback）: GH Pages は 404.html をフォールバックに使えないため、TanStack Router のルートを `/garden-gnome-analytics/` に揃え、`index.html` 直リンクで成立させる
  - もしくは `404.html` を `index.html` のコピーで配置する hack（Pages 仕様で許容される）

### 6.8 README 整備
- [ ] バッジ追加: CI / Pages / License
- [ ] スクリーンショット 1 枚埋め込み
- [ ] ローカルセットアップ手順（pnpm install → ingest → dev）
- [ ] デプロイ手順（main に push）
- [ ] 「ログの置き方」（`data/<event>/<device>/meta.yaml` 構成）

### 6.9 リリース管理（任意）
- [ ] 初回デプロイ後、`v0.1.0` タグを作成し GitHub Release を切る
- [ ] 以降は P0/P1 完了で minor を上げる

## 成果物

```
.github/workflows/
  ci.yml
  deploy.yml

docs/
  data-policy.md

README.md（バッジ・手順）

(リポジトリ設定)
  Settings > Pages > Source: GitHub Actions
```

## 検証方法

```bash
# ローカルから検証
gh workflow run ci.yml --ref <branch>

# main へマージ後
# Actions タブで deploy が緑になることを確認
# https://void2610.github.io/garden-gnome-analytics/ にアクセスし、ダッシュボード表示
```

ブラウザの Network タブで:
- 全 wasm / parquet がリポジトリ配下から 200 で返る
- Range request が機能している（DuckDB-Wasm の部分読み込み）

## リスク / 留意点

- **public-data のサイズ膨張**: コミット運用で詰む可能性。GitHub の単一ファイル 100MB 制限・リポジトリ推奨 1GB を超える兆候が出たら、自動で LFS or Releases asset への移行スクリプトを用意する。
- **Pages のキャッシュ**: 古いアセットがブラウザにキャッシュされて wasm のバージョン不整合が発生しうる。Vite のハッシュファイル名で多くは回避できるが、`manifest.json` だけは固定名なので `Cache-Control` 制御は不可（GitHub Pages では弱い）。バージョン情報を URL クエリで付けるパターンを保険として用意。
- **CI の duckdb prebuilt**: Linux x64 用 prebuilt が提供されているはず。出ていない場合は `node-gyp` ビルドが走り CI 時間が膨らむ。`actions/cache` で `~/.npm` `~/.cache/node-gyp` を保存。
- **PR からの GH Pages デプロイ**: PR では deploy しない方針。プレビュー環境が欲しくなったら `actions/upload-pages-artifact` + `gh-pages` ブランチ運用ではなく、**Cloudflare Pages 連携**を検討（が、依存先を増やすので慎重）。
- **base path の二重化**: `vite preview` のローカル確認と本番 `/garden-gnome-analytics/` の挙動差異を Phase 3 で抑え込んでいるはず。CI でも `pnpm -F @gga/webapp preview` のスモークを 1 ステップ入れる手もある（任意）。

## 次フェーズへの引き継ぎ

- 公開 URL での動作確認が完了 → Phase 7 で残機能と仕上げ。
- データ更新フロー（生ログ追加 → ローカル ingest → コミット & push → 自動デプロイ）が確立。
- 大型イベント追加時に運用ポリシーを再点検する余地（`data-policy.md` を改訂）。

## 完了メモ

- 所要: 約 5 分
- 想定外:
  - PR 検証用 `ci.yml` と main デプロイ用 `deploy.yml` を分離。
  - `pnpm/action-setup@v4` + `actions/setup-node@v4` の組み合わせで pnpm キャッシュも有効。
  - GitHub Pages 設定 (Settings > Pages > Source: GitHub Actions) はリポジトリ所有者側で
    手動切替が必要。
