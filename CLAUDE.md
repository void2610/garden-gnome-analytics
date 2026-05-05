# CLAUDE.md

このリポジトリで作業するときのコンテキスト。技術仕様や手順は `README.md` /
`docs/` 側に集約しているため、ここではコードや既存ドキュメントから読み取れない
背景情報のみを記録する。

## このプロジェクトの位置付け

[`Void2610/the-garden-of-garden-gnome`](https://github.com/Void2610/the-garden-of-garden-gnome)
(以下「ゲーム本体」) のプレイログ専用の分析ダッシュボード。ゲーム本体の作者
本人が運用しており、両リポジトリにまたがる作業を頻繁に行う:

- ヒートマップ等で必要なログフィールドが足りない場合、ゲーム本体側に PR を
  立てて logging を拡張する (例: `mapName` 追加 = ゲーム側 PR #192)。
- 新ログが流れるかは `manifest.hasMapName` 等のフラグで判定し、未対応データ
  セットでは画面側で機能を停止する (互換性ハックは入れない)。

## 想定される運用シナリオ

- ログは展示イベント (ゲムダンなど) で物理機材 (MacBook Pro / Steam Deck 等)
  から収集する。**一般リリース版のテレメトリではない**。
- 収集物には開発者によるテストプレイが混在しているので、本番分析対象だけを
  絞り込む仕組みを **ingest 時** に効かせている。詳細は
  [`docs/event-config.md`](docs/event-config.md):
  - `data/<event>/event.yaml` の `play_hours` で開催時間外のランを除外。
  - `config/exclude_errors.yaml` で常時発生するノイズエラーを除外。
- ingest は手元で実行し、生成物 (`public-data/`) を git 管理してそのまま
  GitHub Pages に載せる静的 SPA 構成。生ログ自体はコミットしない。

## 設定変更時のお作法

`event.yaml` / `meta.yaml` / `exclude_errors.yaml` のいずれかを変更したら:

```bash
pnpm ingest --clean
pnpm fetch-localization   # --clean で消える localization.json を再取得
```

`--clean` を付けないと旧 parquet が残るため、変更が画面に反映されないことが
ある。

## ドキュメント

- [`README.md`](README.md) — 概要・スクリプト・スタック
- [`docs/event-config.md`](docs/event-config.md) — `meta.yaml` / `event.yaml` / `exclude_errors.yaml` の書式
- [`docs/data-schema.md`](docs/data-schema.md) — Parquet / manifest 出力仕様
- [`docs/data-policy.md`](docs/data-policy.md) — 生ログと生成物の取り扱い方針
- [`docs/log-spec.md`](docs/log-spec.md) — ゲーム側ログフォーマット
- [`docs/design.md`](docs/design.md) — 全体設計
- [`docs/plan/`](docs/plan/) — フェーズ別実装計画 (実装履歴として保存)
