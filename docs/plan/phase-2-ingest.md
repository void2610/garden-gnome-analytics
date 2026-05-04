# Phase 2: 取り込み CLI と Parquet 出力

## 目的

`data/<event>/<device>/` 配下の生ログ群を走査し、Phase 1 のパーサ純関数で正規化したうえで、DuckDB の `COPY ... TO ... (FORMAT PARQUET)` で `public-data/` 以下の Parquet に書き出す。Webapp はこの Parquet 群だけを読めば動くようにする。

## ゴール（Definition of Done）

1. `pnpm ingest` 一発で `data/` 配下の全ログから `public-data/{events,runs,errors}/...parquet` と `manifest.json` が生成される。
2. 各 Parquet は **イベント・機器でパーティション**されている（`event=<slug>/device=<slug>/...`）。
3. `meta.yaml` がないディレクトリは警告して**スキップ**（処理は止めない）。
4. 大ファイル（数十万行）でも Node ヒープを破壊せずストリーム処理で完了する。
5. 進捗ログが `pino-pretty` で読みやすく出力される。
6. 実データ（`/Users/shuya/Downloads/ゲムダン12 ver 0.2.x デモ展示/`）を `data/` に配置→ingest が成功し、生成 Parquet を DuckDB CLI で `SELECT COUNT(*)` できる。
7. Vitest の統合テスト（一時ディレクトリで小規模 fixture をフルパイプライン実行）が緑。

## タスク

### 2.1 出力スキーマ確定
- [ ] `events.parquet`（縦持ち、1 イベント 1 行）
  - 列: `event_slug`, `device_slug`, `run_id`, `seq` (run 内連番), `timestamp` (TIMESTAMP), `event_type` (VARCHAR), `payload` (JSON), `game_version`
- [ ] `runs.parquet`（ラン単位サマリ、1 ラン 1 行）
  - 列: `run_id`, `event_slug`, `device_slug`, `started_at`, `ended_at`, `duration_sec`, `stage_count`, `battle_win_count`, `battle_loss_count`, `final_hp`, `max_hp`, `final_deck_size`, `outcome` (`win`/`loss`/`abandoned`), `game_version`
- [ ] `errors.parquet`（通常ログから抽出した Error/Exception、1 行 1 件）
  - 列: `event_slug`, `device_slug`, `run_id?`, `timestamp`, `level`, `message`, `stack_trace?`
- [ ] `manifest.json`（webapp のデータセット選択 UI で利用）
  - スキーマ: `{ generatedAt, datasets: [{ event, device, meta, runCount, eventCount, errorCount, period: {from,to} }] }`
- [ ] スキーマ仕様を `docs/data-schema.md` に明文化

### 2.2 ディレクトリ走査
- [ ] `src/scan.ts`: fast-glob で `data/*/*/meta.yaml` を列挙
- [ ] 各 meta.yaml ディレクトリにつき:
  - run ログ: `run_*.log`
  - 通常ログ: `the-garden-of-garden-gnome_*.log`
- [ ] スラッグ生成: `event` と `device` を `slugify` （ASCII 化、空白→`-`、小文字化）
- [ ] meta.yaml 不在時は warn で報告、ingest は継続

### 2.3 ラン単位サマリ作成
- [ ] `src/aggregateRun.ts`: 1 ラン分の `RunEvent[]` から `runs.parquet` 1 行を作る純関数
  - `started_at` = `SessionStart` の timestamp（無ければ最初のイベント）
  - `ended_at` = `SessionEnd` または最後のイベント
  - `outcome` 判定: `BattleWin` 後に `SessionEnd` あり → `win`、`PlayerHealthChanged hp=0` または HP 直接死亡 → `loss`、それ以外で `SessionEnd` なし → `abandoned`
  - `final_deck_size` = 最終 `BattleStart.deckCards.length` または最後の reward 反映後
- [ ] テスト: 勝ちラン・途中放棄・敗北のサンプルで期待値検証

### 2.4 DuckDB 書き出し
- [ ] `src/writer.ts`
  - `duckdb` Node binding で in-memory DB を作成
  - 一時テーブル `events_tmp` `runs_tmp` `errors_tmp` を CREATE
  - パース結果を `Appender` API でバルク insert（`prepare` + ループより速い）
  - `COPY events_tmp TO 'public-data/events/event=<e>/device=<d>/data.parquet' (FORMAT PARQUET, COMPRESSION ZSTD)` を発行
  - `runs.parquet` `errors.parquet` も同様
- [ ] パーティションごとに 1 回ずつ書き出すループ（Hive 形式の手動構築）

### 2.5 CLI（`packages/parser/src/cli/ingest.ts`）
- [ ] CLI フレームワーク不要、`process.argv` を直接読む（または `commander` 軽量採用）
- [ ] フラグ:
  - `--data-dir <path>` (デフォルト `./data`)
  - `--out <path>` (デフォルト `./public-data`)
  - `--dev`: JSONL も併出力（ファイル名 `*.jsonl`）
  - `--filter <event-slug>`: 指定イベントのみ処理（デバッグ用）
  - `--clean`: 出力先を消してから生成
- [ ] 進捗表示: pino + pino-pretty
  - 「meta=N 件発見」「parsing run X/Y」「writing parquet ...」「done in T ms」

### 2.6 manifest.json 生成
- [ ] `src/manifest.ts`: 全 dataset を集約して manifest を出力
- [ ] `meta.yaml` の中身も dataset エントリに含める（webapp 表示用）

### 2.7 統合テスト
- [ ] `test/integration/ingest.test.ts`
  - `tmp` ディレクトリに mini fixture（meta.yaml + run + normal）を配置
  - `runIngest({ dataDir, outDir })` を呼ぶ
  - 生成された Parquet を DuckDB Node で `SELECT COUNT(*)` し期待値検証
  - manifest の生成内容を JSON snapshot で比較

### 2.8 実データ投入
- [ ] `data/gemudan12-demo-2026-05/macbook-pro/` `data/gemudan12-demo-2026-05/steamdeck/` を作成
- [ ] それぞれに meta.yaml を作成
- [ ] 実ログをコピー（`data/` は gitignore なのでコミットされない）
- [ ] `pnpm ingest` 実行
- [ ] 生成された `public-data/events/...parquet` を `duckdb` CLI でクエリし行数・期間を確認

## 成果物

```
packages/parser/src/
  cli/ingest.ts
  scan.ts
  aggregateRun.ts
  writer.ts
  manifest.ts
  utils/slugify.ts

packages/parser/test/integration/
  ingest.test.ts
  fixtures/mini-data/...

public-data/
  manifest.json
  events/event=<slug>/device=<slug>/data.parquet
  runs/event=<slug>/device=<slug>/data.parquet
  errors/event=<slug>/device=<slug>/data.parquet

docs/data-schema.md
```

## 検証方法

```bash
# 単体・統合テスト
pnpm -F @gga/parser test

# 実データで動作確認
cp -r "/Users/shuya/Downloads/ゲムダン12 ver 0.2.x デモ展示/MacbookPro" \
      data/gemudan12-demo-2026-05/macbook-pro
# meta.yaml を作成
pnpm ingest

# 生成物を DuckDB CLI で検査
duckdb -c "SELECT COUNT(*) FROM 'public-data/events/event=*/device=*/data.parquet'"
duckdb -c "SELECT outcome, COUNT(*) FROM 'public-data/runs/**/*.parquet' GROUP BY 1"
```

## リスク / 留意点

- **`duckdb` Node binding のビルド**: prebuilt が macOS arm64 に出ているか確認。出ていなければ node-gyp ビルドが走り Xcode CLT が必要。
- **Parquet ZSTD**: DuckDB のバージョンに依らず利用可能だが、明示指定する。
- **パーティションでの空ディレクトリ**: ある event/device にデータが無い場合、`COPY` を呼ばず manifest からも除外する。
- **`payload` JSON 列のサイズ肥大**: 全イベントを 1 ファイルに縦持ちするので、頻出イベント（PlayerMoved）が支配的。後段で支配的イベントの主要列を**展開列**として持つ最適化を検討（Phase 5 まで様子見）。
- **大文字小文字**: ファイルシステムが case-insensitive な macOS でも、出力スラッグは小文字に揃える（GH Pages は case-sensitive）。
- **slug 衝突**: 同じイベント名の展示が将来あった場合、meta.yaml に `slug` フィールドを許可して上書きできるようにしておく。
- **実データに個人情報**: ログ内 `persistentDataPath` にユーザー名（`/Users/masatoyasufuku/...`）が出る。これは生ログのみで、`events.parquet` 等の正規化先には載せない（または mask）。

## 次フェーズへの引き継ぎ

- webapp は `public-data/manifest.json` をエントリポイントとして、必要な Parquet を DuckDB-Wasm の httpfs 経由で読む。
- Parquet スキーマは `docs/data-schema.md` で固定済み → webapp 側はこの仕様を信じてクエリを書ける。
- ingest は冪等であること（再実行で同じ結果）を担保しておくと、CI でも回せる。

## 完了メモ
