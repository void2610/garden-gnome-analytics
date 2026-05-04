# 実装計画

`docs/design.md` と `docs/tech-stack.md` の決定事項を、実行可能なフェーズに分割した実装計画。

## フェーズ一覧

| # | フェーズ | 主成果物 | 依存 |
| --- | --- | --- | --- |
| 0 | [プロジェクト基盤構築](phase-0-foundation.md) | pnpm workspaces / TS / Biome / Vitest の土台 | なし |
| 1 | [ログパーサ実装](phase-1-parser.md) | `@gga/shared` 型・`@gga/parser` パース純関数群 | 0 |
| 2 | [取り込み CLI と Parquet 出力](phase-2-ingest.md) | `pnpm ingest` で `public-data/*.parquet` 生成 | 1 |
| 3 | [webapp 基盤構築](phase-3-webapp-base.md) | Vite + Mantine + TanStack Router + DuckDB-Wasm の起動 | 2 |
| 4 | [P0 コア可視化機能](phase-4-core-features.md) | ダッシュボード／ラン一覧・詳細／カード分析／フィルタ | 3 |
| 5 | [P1 拡張可視化機能](phase-5-extended-features.md) | ステージ分析／ヒートマップ／エラー連動／横断検索 | 4 |
| 6 | [CI/CD とデプロイ](phase-6-cicd.md) | GitHub Actions + GitHub Pages 公開 | 4 (5 の前後どちらでも可) |
| 7 | [P2 機能と仕上げ](phase-7-polish.md) | 比較ビュー／エクスポート／リプレイ／README 整備 | 5, 6 |

## フェーズ間の並走可否

- **Phase 6（CI/CD）は Phase 4 完了後にいつでも開始可能**。Phase 5 と並走させて良い。
- **Phase 7 は最後にまとめて**実施。
- Phase 0〜4 は順序固定。

## 各フェーズ文書の構造

すべての phase-N-*.md は以下の節を持つ。

1. **目的** — そのフェーズが何のために存在するか
2. **ゴール（Definition of Done）** — 完了判定の客観基準
3. **タスク** — チェックリスト形式の実行単位（粒度: 30 分〜半日）
4. **成果物** — このフェーズで生まれるファイル／コマンド
5. **検証方法** — タスク完了確認の手順
6. **リスク / 留意点** — 既知の落とし穴
7. **次フェーズへの引き継ぎ** — Phase N+1 が前提とする状態

## 進め方

- 1 フェーズずつ「ゴール充足→コミット→次フェーズ」のサイクル。
- 同フェーズ内のタスクは原則上から順に実施。
- フェーズ完了時はその phase ファイルの末尾「完了メモ」節に簡潔な結果メモを追記する（コミットハッシュ、所要時間、想定外の遭遇事象）。
