# ログ仕様

## 通常ログ (a) `the-garden-of-garden-gnome_<YYYYMMDD>_<HHMMSS>.log`

```
YYYY-MM-DD HH:MM:SS.fff [Level] message
```

`Level` は `Log` / `Error` / `Exception` / `LogManager` / `Warning`。
`Exception` の後続行（インデントや空行を含む）はスタックトレースとして直前 entry に連結する。
`[AnalyticsLogger] ランログ開始: <path>` で run ログとの対応を取る。

## ラン解析ログ (b) `run_<YYYYMMDD>_<HHMMSS>_<ms>.log`

```
<ISO8601 ローカル時刻>|<EventName>|<key>=<value>|<key>=<value>...
```

タイムゾーン情報は付与されない（ローカル時刻として解釈）。リスト値は `;` 区切り。
`Olive(Seed)` のように `()` 付きでカード成長段階を表す。値の中の `\` `|` `=` 改行は、ゲームが `\\` `\p` `\e` `\n` にエスケープして書くので、読むときに戻す。

## イベントとキー

イベントとキーの正は、ゲーム側の [`Docs/analytics-log-spec.md`](https://github.com/void2610-org/the-garden-of-garden-gnome/blob/main/Docs/analytics-log-spec.md)。
分析側で読むイベントは `packages/shared/src/events/payloads.ts` の `RUN_EVENT_SCHEMAS` に並べる。ここにスキーマを足せば、読めるイベントの名前と型にも入る。

- スキーマに書いたキーは型 (数値は `intFromString`) で読み、書いていないキーも文字列のまま payload に残す
- 全キーが省略可能なので、古いログで欠けているキーは payload に出ず、SQL の `json_extract` は NULL を返す

## 未知イベントの扱い

`RUN_EVENT_SCHEMAS` に無いイベントの行は `unknown_event` として捨て、ingest は止めない (warn ログのみ)。
ゲーム側でイベントを足したら、ここにスキーマを足す。
