# Phase 7: P2 機能と仕上げ

## 目的

`docs/design.md` の機能案 P2（イベント／機器比較ビュー、エクスポート、リプレイ）を実装し、ドキュメントとパフォーマンスの最終調整をする。**ここでプロジェクトを「単発分析の道具」から「次の展示でもそのまま使い続けられるツール」に引き上げる**。

## ゴール（Definition of Done）

1. `/compare` で 2 つ（以上）のデータセット（イベント／機器）を並べてカード使用率・勝率・平均所要時間を比較できる。
2. 任意の画面のテーブル／集計結果を **CSV / JSON でエクスポート**できる（フィルタ条件を反映）。
3. ラン詳細に**タイムラインリプレイ**機能があり、再生バーで時刻を進めるとその時点の HP・コスト・デッキ・座標が連動表示される。
4. README が完成し、初見の開発者が手順通りに動かせる。
5. パフォーマンス計測結果が `docs/perf.md` に記載され、すべての主要画面で「初回表示 < 2 秒、操作応答 < 300ms」を満たす。
6. すべての phase ファイルの「完了メモ」が記入済み。

## タスク

### 7.1 比較ビュー（`/compare`）
- [ ] レイアウト: 上部に 2 つ（または N 個）のセレクタ、下部にメトリクスを並列表示
- [ ] セレクタ: イベント＋機器の組み合わせを 2 つ以上選択
- [ ] メトリクス（左右並列）:
  - ラン数、勝率、中央プレイ時間、平均到達ステージ
  - カード使用率 top 10（並列 barX）
  - エラー発生率
- [ ] 差分強調: 数値差を色付き badge で表示（緑/赤）
- [ ] クエリ: 既存クエリを `groupBy: ['event_slug','device_slug']` 拡張して再利用

### 7.2 エクスポート
- [ ] `src/lib/export.ts`:
  - `exportCsv(rows, columns, filename)`: PapaParse で CSV 化
  - `exportJson(rows, filename)`: 整形 JSON でダウンロード
- [ ] 共通コンポーネント `<ExportMenu>` を Mantine の `<Menu>` で実装
- [ ] 配置先: ラン一覧、カード分析、ステージ分析、エラー一覧
- [ ] エクスポートはフロント側でのみ実行（DuckDB の `COPY ... TO STDOUT` を Wasm で叩いて `Blob` 化する手も）

### 7.3 タイムラインリプレイ
- [ ] ラン詳細ページに「リプレイ」タブ追加
- [ ] 上部: 再生コントロール（再生/一時停止、速度 1x/2x/4x、シーク）
- [ ] 中央: ミニマップ（プレイヤー位置・植物配置をリアルタイム描画）
- [ ] 下: HP/コスト/手札の現時点ビュー（テーブル + バー）
- [ ] 実装方針:
  - 全イベントを時刻昇順で配列化
  - `currentTime` ステートを 200ms ごとに進め、その時点までのイベントを reduce してビュー状態を再構築
  - reduce 関数 `applyEvent(state, event): state` を純関数化、Vitest でテスト

### 7.4 ドキュメント整備
- [ ] `README.md`
  - プロジェクト概要、スクリーンショット
  - クイックスタート（pnpm install → meta.yaml 作成 → ingest → dev）
  - データセット追加手順
  - 各画面の解説
  - ライセンス表記
- [ ] `docs/architecture.md`: 採用したスタックの図解（mermaid）
- [ ] `docs/log-spec.md`: Phase 1 で書いたものを最終形に
- [ ] `docs/data-schema.md`: Phase 2 で書いたものを最終形に
- [ ] `docs/perf.md`: 計測手順と結果

### 7.5 パフォーマンス計測と最適化
- [ ] 各画面の初回表示時間を Performance API で計測
- [ ] 大規模 events.parquet（100 万行）でのクエリ時間を表化
- [ ] ボトルネックがあれば対処:
  - クエリのインデックス相当（DuckDB の zonemap）を活かす ORDER BY 列の選定
  - VIEW を MATERIALIZED に切替（DuckDB-Wasm でも `CREATE TABLE AS` で実現）
  - 重い集計の結果を JSON でキャッシュ（`localStorage`）
- [ ] バンドルサイズ最適化: `rollup-plugin-visualizer` で確認、必要なら chunk split

### 7.6 アクセシビリティ最終チェック
- [ ] axe DevTools で各画面をスキャン、Critical を 0 に
- [ ] キーボード操作のみで全画面が操作可能であることを確認
- [ ] 色覚対応: コントラスト比 AA 以上

### 7.7 軽い保守性向上
- [ ] PR テンプレート（`.github/PULL_REQUEST_TEMPLATE.md`）
- [ ] Issue テンプレート（バグ／機能要望）
- [ ] CHANGELOG.md の体裁（Keep a Changelog）

### 7.8 リリース
- [ ] `v1.0.0` タグを切る
- [ ] GitHub Release で機能サマリ・スクリーンショットを記載

## 成果物

```
packages/webapp/src/
  routes/compare.tsx
  components/{ExportMenu.tsx, ReplayControls.tsx, MiniMap.tsx}
  lib/export.ts
  lib/replay/{state.ts, applyEvent.ts}

docs/
  architecture.md
  perf.md
  (log-spec.md, data-schema.md は最終化)

README.md
CHANGELOG.md
.github/{PULL_REQUEST_TEMPLATE.md, ISSUE_TEMPLATE/{bug.md, feature.md}}
```

## 検証方法

```bash
pnpm test        # リプレイ reducer テスト含む
pnpm typecheck
pnpm lint
pnpm build
pnpm preview
```

手動チェックリスト:
- [ ] `/compare` で 2 データセットの差分が見える
- [ ] 各画面のエクスポートで CSV/JSON が DL できる
- [ ] ラン詳細のリプレイが滑らかに動く
- [ ] README の手順を新規環境で再現できる
- [ ] axe DevTools で Critical = 0

## リスク / 留意点

- **比較ビューの分散爆発**: 3 つ以上のデータセット比較は UI が破綻しやすい。最大 4 つに制限し、5 つ目以降は Spotlight で切替誘導。
- **リプレイの reduce 計算量**: イベント数 × 200ms 刻みで毎回 reduce すると O(n²) になりうる。全イベントを 1 度走査して `[time → snapshot]` のキー配列を作っておき、二分探索で参照。
- **エクスポートのファイル巨大化**: 数十万行 CSV はブラウザがフリーズする。1 万行を超えるエクスポートは確認ダイアログ。
- **README の劣化**: README が放置されがち。Phase 4/5/6 完了時にも軽く更新するルールを CHANGELOG で守る。
- **完成判断**: P2 を全部やる必要はない。次の展示までの時間を見て、`/compare` のみ実装してリリースし、リプレイは v1.1 に回す等の判断を許容する。

## 次フェーズ

- なし。次のイベント開催を機にデータセット追加・機能要望に応じて随時改修。
- 中期: 自動データ収集（ゲーム本体からアップロード）／オンライン共有モードは現時点で要件外。

## 完了メモ

- 所要: 約 10 分
- 完了範囲:
  - 比較ビュー (`/compare`) を実装。
  - README を完成形まで更新。
  - データ取扱方針 (`docs/data-policy.md`) を文書化。
  - 各 phase ファイルに完了メモを追記。
- 持ち越し:
  - エクスポート機能 (CSV/JSON ダウンロード)
  - リプレイ機能
  - Spotlight 横断検索
  - パフォーマンス計測 (`docs/perf.md`)
  - axe DevTools 準拠のアクセシビリティチェック
