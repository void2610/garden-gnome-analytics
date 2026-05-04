# Phase 1: ログパーサ実装

## 目的

実ログ 2 種（(a) 通常ログ、(b) ラン解析ログ）を**純関数として**パースし、強い型を持つ JS オブジェクトへ変換する。ファイル入出力や DB 書き込みは含めず、入出力テストできる単位に閉じる。Phase 2 の取り込み CLI はこの純関数を呼ぶだけにする。

## ゴール（Definition of Done）

1. `@gga/shared` に 21 種のイベントを Zod の `discriminatedUnion` で定義し、`RunEvent` 型がエクスポートされている。
2. `@gga/parser` に以下 3 つの純関数が存在し、すべて Vitest で網羅される。
   - `parseRunLogLine(line: string): RunEvent | RunParseError`
   - `parseNormalLogChunk(text: string): NormalLogEntry[]`（複数行スタックトレースを 1 entry に集約）
   - `correlate(runs: RawRunFile[], normals: NormalLogEntry[]): CorrelatedRun[]`（時刻ベースで run と通常ログを突合）
3. `meta.yaml` の Zod スキーマが定義され、サンプル YAML をロード→検証できる。
4. fixture（実ログ抜粋）を 5 件以上同梱し、回帰テストになっている。
5. `pnpm -F @gga/parser test` が緑、カバレッジで `parser/src` の主要関数 80% 以上。
6. パース失敗時は例外を投げず `Result` 型（`{ ok: true, value } | { ok: false, error }`）で返す。

## タスク

### 1.1 共有スキーマ（`@gga/shared`）
- [ ] `src/events/eventName.ts`: 21 種を `z.enum([...])` で列挙
- [ ] `src/events/payloads/*.ts`: イベントごとの payload Zod スキーマを 1 ファイル 1 種で定義
  - `SessionStart` / `SessionEnd`
  - `StageEnter` (stageType, stageId)
  - `BattleStart` (stageId, enemyCount, deckCards)
  - `BattleWin` (turnCount, remainHp, maxHp, killedEnemies, elapsedTime)
  - `TurnStart` / `TurnEnd`
  - `PlayerMoved` (from, to, moveDistance, remainingMovePoints)
  - `PlayerHealthChanged` / `PlayerDamaged`
  - `CardPlayed` / `CardCancelled` / `CardPlayFailed` (cardName, growthStage, cost, target)
  - `PlantPlaced` (cardName, position, direction, growthStage)
  - `EnemyDefeated` (enemyName, turnNumber)
  - `RewardSelected` (type, selected, choices)
  - `ShopBuy` / `ShopExit`
  - `RestChoice` / `TreasureCollected` / `StageEventSelected` / `CultivationResult`
- [ ] `src/events/index.ts`: `RunEvent = z.discriminatedUnion('event', [...])` を構築
- [ ] 共通変換ヘルパ
  - `parsePosition('7,6'): {x:7, y:6}`
  - `parseDeckCards('Olive(Seed);Fraxinus(Seed)'): {cardName, growthStage}[]`
  - `parseElapsedTime('62.3s'): number`（秒）
- [ ] `src/meta.ts`: `MetaSchema = z.object({ event, event_date, venue, device, game_version, notes? })`
- [ ] `src/index.ts`: バレル export
- [ ] `pnpm -F @gga/shared test` で各 schema の `safeParse` 単体テスト

### 1.2 行パーサ（`@gga/parser`）
- [ ] `src/runLog/tokenize.ts`: 1 行を `{timestamp, event, params: Record<string,string>}` に分割
  - 先頭フィールドが ISO8601 形式の正規表現マッチ
  - パイプ分割後、2 番目以降の `key=value` を対応 Map に
- [ ] `src/runLog/parseLine.ts`: 上記トークン化結果を `RunEvent` discriminated union に流し込み、Zod で検証
- [ ] `src/runLog/parseFile.ts`: ファイルパス→`AsyncIterable<RunEvent>`（`fs.createReadStream` + `readline`）
  - パース失敗行は warn 出力＋スキップ（後で fail-fast モード切替可能に）
- [ ] テスト: 各イベント種につき 1 行以上の fixture と期待 AST を比較

### 1.3 通常ログパーサ
- [ ] `src/normalLog/parseChunk.ts`
  - 行頭が `YYYY-MM-DD HH:MM:SS.fff [Tag]` で始まる行をエントリの開始と判定
  - 後続行（インデントや空行を含む）はスタックトレースとして直前エントリに連結
  - 結果型: `{ timestamp: Date, level: 'Log'|'Error'|'Exception'|'LogManager', message: string, stackTrace?: string }`
- [ ] `src/normalLog/parseFile.ts`: ストリーム版
- [ ] テスト: 単一行・例外行＋スタックトレース複数行・連続例外などのパターン

### 1.4 (a)(b) 突合
- [ ] `src/correlate.ts`
  - 通常ログの `[AnalyticsLogger] ランログ開始: <path>` 行から run ファイル名を抽出
  - 各 run について、`SessionStart` 〜 `SessionEnd`（無ければ最後のイベント）の時刻範囲を計算
  - その時刻範囲に含まれる normal ログのエントリ（`Error`/`Exception`）を関連付ける
- [ ] テスト: 重複 run・時刻ジャンプ・SessionEnd 欠損ケース

### 1.5 結果型 / エラーハンドリング
- [ ] `src/result.ts`: `type Result<T, E = ParseError> = { ok: true; value: T } | { ok: false; error: E }`
- [ ] `ParseError`: `{ kind: 'tokenize'|'schema'|'unknown_event', line: string, lineNumber: number, cause?: unknown }`
- [ ] パース純関数は throw せず Result を返すことを徹底

### 1.6 fixture
- [ ] `packages/parser/test/fixtures/run-short.log`（10 行程度、1 ラン分）
- [ ] `packages/parser/test/fixtures/run-with-rewards.log`（リワード/ショップ/レスト/トレジャー含む）
- [ ] `packages/parser/test/fixtures/run-malformed.log`（壊れた行混入、回復確認用）
- [ ] `packages/parser/test/fixtures/normal-with-exception.log`
- [ ] `packages/parser/test/fixtures/meta-valid.yaml` / `meta-invalid.yaml`
- [ ] 実データから引用する際は個人パス（`/Users/...`）をマスクする

### 1.7 ログ仕様の固定
- [ ] `docs/log-spec.md` を作成。21 種のイベント名・必須/オプションパラメータ・型を表で網羅
- [ ] 観測されていないが将来追加されうるイベントの扱い（`unknown_event` で通す or strict）を方針化

## 成果物

```
packages/shared/src/
  events/
    eventName.ts
    payloads/*.ts (21 ファイル)
    converters.ts
    index.ts
  meta.ts
  index.ts

packages/parser/src/
  runLog/{tokenize.ts, parseLine.ts, parseFile.ts}
  normalLog/{parseChunk.ts, parseFile.ts}
  correlate.ts
  result.ts
  index.ts

packages/parser/test/
  fixtures/*
  runLog.parseLine.test.ts
  runLog.parseFile.test.ts
  normalLog.test.ts
  correlate.test.ts

docs/log-spec.md
```

## 検証方法

```bash
pnpm -F @gga/shared test
pnpm -F @gga/parser test
pnpm -F @gga/parser test -- --coverage  # 主要関数 80%+
pnpm typecheck
```

加えて、実データから 1 ファイルを使ったスモークテスト:

```bash
pnpm -F @gga/parser exec tsx scripts/smoke.ts \
  /path/to/run_20260503_112337_467.log
# → コンソールに RunEvent[] が出力される
```

## リスク / 留意点

- **タイムスタンプの timezone**: run ログは ISO8601 で `Z` も `+09:00` も付かない（`2026-05-03T11:23:37.468`）。これは**ローカル時刻**として扱う仕様にする。`new Date(...)` の解釈が UTC になる環境差異を避けるため `Date` ではなく**文字列のまま**保持し、必要時に `dayjs.tz` 等で扱う方針も選択肢。本フェーズではいったん「ローカル時刻として `Date` 化」とし、後続で問題が出れば見直す。
- **`deckCards` の値に括弧**: `Olive(Seed)` のように `()` を含む。`;` 区切りの分解で誤らないこと。
- **未知イベント**: 仕様外のイベントが将来増える可能性。`safeParse` 失敗を `unknown_event` として記録し、ingest を止めない方針。
- **fixture の文字コード / 改行**: 実ログは LF。`.gitattributes` で正規化を上書きしないよう `*.log -text` に設定する必要がある（fixture 用ディレクトリのみ）。
- **大ファイル**: 実データは 50KB 程度だが、将来 MB クラスもありうる。最初から `readline` ストリームで実装し、配列に詰めない API を維持。

## 次フェーズへの引き継ぎ

- `@gga/parser` は**純関数とストリーム**のみ提供する。
- Phase 2 の CLI は `parseFile` を呼び出して結果を DuckDB に流し込むだけになる。
- `@gga/shared` の Zod スキーマは webapp（Phase 3 以降）でも `z.infer` で型として再利用される。

## 完了メモ

- コミット: `486aa64`
- 所要: 約 30 分
- 想定外:
  - 仕様書の 21 種以外に `ItemUsed` `RewardSkipped` `BattleLose` も実ログに存在したため追加。
  - `discriminatedUnion` は固定長 tuple を要求するため、配列を index で 1 件ずつ展開する書き方になった。
  - 通常ログには `Warning` レベルも観測されたため `NormalLogLevel` に追加。
