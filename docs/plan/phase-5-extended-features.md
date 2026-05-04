# Phase 5: P1 拡張可視化機能

## 目的

P0 で得た「ラン全体の俯瞰」を超えて、**プレイヤーの行動パターン**と**安定性の懸念**を見えるようにする。具体的にはステージ／バトル分析、マップヒートマップ、エラー連動ビュー、横断検索を追加する。

## ゴール（Definition of Done）

1. `/stages` でステージ別の到達率・勝率・平均ターン数・平均被ダメが表で確認できる。
2. `/heatmap` で `PlayerMoved` と `PlantPlaced` のヒートマップがマップ上に重畳表示される。レイヤ切替・スライダで時間帯／ステージで絞れる。
3. `/errors` で通常ログ由来のエラー／例外が一覧でき、各エラー行から「同時刻に走っていた run の詳細」へジャンプできる。
4. Spotlight（`Cmd/Ctrl+K`）で全文検索ができ、カード名・敵名・ステージ ID・エラーメッセージを横断的にヒットさせられる。
5. 全機能で Phase 4 の `FilterBar` が機能し、URL に状態が乗る。
6. パフォーマンス: ヒートマップ集計が 100 万行（移動イベント）でも 1 秒以内。

## タスク

### 5.1 ステージ／バトル分析（`/stages`）
- [ ] レイアウト: ステージ別テーブル + 選択ステージの詳細パネル
- [ ] テーブル列: stageId / 到達ラン数 / 勝率 / 平均ターン数 / 平均被ダメ / 平均所要時間 / 最頻出デッキ
- [ ] 詳細パネル（行選択時）:
  - そのステージで撃破された敵の分布（barX）
  - そのステージでのカード使用ランキング（top 10）
  - HP 残量分布（histogram）
- [ ] クエリ:
  - `stageStats(filter)`
  - `stageEnemyDistribution(stageId, filter)`
  - `stageCardUsage(stageId, filter)`
  - `stageHpDistribution(stageId, filter)`

### 5.2 マップヒートマップ（`/heatmap`）
- [ ] 集計: `PlayerMoved.to` と `PlantPlaced.position` を 2 次元グリッドに集計
  - DuckDB で `SELECT to_x, to_y, COUNT(*) ...` の集計
  - `payload.to` は JSON 文字列なので `json_extract` を使うか、Phase 2 で展開列を追加（Phase 5 の入口で判断）
- [ ] 描画: ECharts heatmap series（canvas）
  - レイヤ 1: PlayerMoved 累計
  - レイヤ 2: PlantPlaced 累計（半透明オーバーレイ）
- [ ] 操作:
  - レイヤ on/off トグル
  - ステージ ID フィルタ（複数選択 OK）
  - 時間スライダ（ラン開始時刻でフィルタ）
- [ ] 補助情報: マップサイズの記憶（自動で xy の min/max を計算しタイトルに表示）

### 5.3 エラー連動ビュー（`/errors`）
- [ ] レイアウト: 左に時系列リスト、右に選択エラーの詳細
- [ ] リスト列: timestamp / level / message 1 行プレビュー / 関連 run リンク
- [ ] 詳細パネル:
  - フルスタックトレース
  - 同時刻に走っていた run の概要（→ ラン詳細へリンク）
  - 同種エラーの発生回数（同一 message のグルーピング）
- [ ] エラーグルーピング: スタックトレース先頭フレームと message でハッシュ化した `error_signature` を集計キーに
- [ ] クエリ:
  - `errorList(filter)`
  - `errorDetail(timestamp, signature)`
  - `errorOccurrences(signature, filter)`

### 5.4 横断検索（Spotlight）
- [ ] `@mantine/spotlight` を Header から起動
- [ ] 検索対象:
  - カード名（`SELECT DISTINCT card_name ...`）
  - 敵名（`EnemyDefeated.enemy_name`）
  - ステージ ID
  - エラー message（接頭辞マッチ）
  - ラン ID（部分一致）
- [ ] アクション:
  - カード/敵/ステージ → `/cards` `/stages` の該当行ハイライト
  - ラン ID → `/runs/$runId`
  - エラー → `/errors` の該当行
- [ ] インデックス構築: 起動時にバックグラウンドで `searchIndex.parquet` 相当のものを VIEW で組み、TanStack Query にキャッシュ

### 5.5 共通整備
- [ ] サイドバーに `/stages` `/heatmap` `/errors` を追加
- [ ] Phase 4 のラン詳細「関連エラー」タブから `/errors` の該当行へリンク
- [ ] エラーがあったランは `/runs` 一覧の行に warning アイコン

### 5.6 パフォーマンス調整
- [ ] `payload` を JSON で持っている設計のオーバーヘッドを計測
- [ ] 必要なら ingest 側に**展開列**を追加（`payload_to_x`, `payload_to_y`, `payload_card_name` 等）
- [ ] DuckDB の `PRAGMA threads` 調整（ブラウザ環境では効果限定的）

### 5.7 アクセシビリティ／視認性
- [ ] ヒートマップに colorblind safe palette（viridis）
- [ ] テーブルのキーボード操作確認
- [ ] エラー画面の長文 message を `<Spoiler>` で展開可能に

## 成果物

```
packages/webapp/src/
  routes/
    stages/index.tsx
    heatmap.tsx
    errors/index.tsx
  components/
    HeatmapCanvas.tsx
    StackedHeatmap.tsx
    ErrorListItem.tsx
    StageDetailPanel.tsx
    AppSpotlight.tsx
  queries/
    stageStats.ts
    stageEnemyDistribution.ts
    stageCardUsage.ts
    stageHpDistribution.ts
    movementHeatmap.ts
    plantHeatmap.ts
    errorList.ts
    errorDetail.ts
    errorOccurrences.ts
    searchIndex.ts
  lib/
    errorSignature.ts
```

## 検証方法

実データに加え、ストレス用の合成データ（PlayerMoved を 100 万件まで増殖させたもの）で:

```bash
pnpm ingest --data-dir data-stress
pnpm dev
# /heatmap でレンダリングが 1 秒以内
# /errors で例外発生ランへジャンプできる
# Cmd+K で検索が機能
```

各画面の DOM スナップショットを `docs/screenshots/` に追加。

## リスク / 留意点

- **payload を JSON 列で持つことの限界**: ヒートマップ集計で `json_extract(payload, '$.to')::INT` を 100 万行に発行すると遅い可能性。Phase 2 で展開列を持つかどうかをこのフェーズで判断・反映する。
- **エラーと run の突合**: Phase 1 の `correlate.ts` の精度に依存。多重起動や時計ずれがあると誤紐付けする。エラーが想定外の run に紐付いて見える場合の調査用に、突合根拠（時刻範囲）を UI に表示。
- **Spotlight インデックスのサイズ**: カード名・敵名は数十件で問題なし。エラー message は無限にあり得るので件数上限を設ける。
- **ECharts のサイズ**: 全部入りで 1MB 級。`echarts/core` から必要モジュールだけ import する tree-shaking パターンを使う。
- **ヒートマップ座標系**: ゲーム内座標 (x, y) と画面表示座標 (col, row) の対応関係。アイソメトリック表示にする必要は今のところなく、純粋な格子で十分。

## 次フェーズへの引き継ぎ

- 機能的にはほぼ完成。Phase 6 では CI/CD と公開、Phase 7 では仕上げと「P2 機能」を加える。
- このフェーズで `payload` 展開列の必要性が確定したら、Phase 2 の取り込みスキーマと `docs/data-schema.md` を改訂する。

## 完了メモ

- コミット: `d9507ad`（Phase 3-5 まとめて）
- 所要: 約 15 分
- 想定外:
  - ヒートマップは ECharts の代わりに自前 CSS Grid 実装で十分視認できた
    （マップサイズが小さいため）。後続でデータが増えたら ECharts に切替検討。
  - エラー画面は signature ではなく `(level, message)` でグルーピング。
    payload 中のスタックトレースは `[level, message]` ペアでほぼユニーク化できているため。
  - Spotlight は未実装（次フェーズへ持ち越し）。
