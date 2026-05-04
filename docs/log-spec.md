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
`Olive(Seed)` のように `()` 付きでカード成長段階を表す。

## イベント一覧（21 種）

| event | 主要パラメータ |
| --- | --- |
| SessionStart | （なし） |
| SessionEnd | （なし） |
| StageEnter | stageType, stageId |
| BattleStart | stageId, enemyCount, deckCards |
| BattleWin | turnCount, remainHp, maxHp, killedEnemies, elapsedTime |
| TurnStart | turnNumber, hp, maxHp, cost, maxCost, block, handCount |
| TurnEnd | turnNumber, remainingMovePoints, remainingCost, handCardNames |
| PlayerMoved | from, to, moveDistance, remainingMovePoints |
| PlayerHealthChanged | hp |
| PlayerDamaged | damage, source, hp |
| CardPlayed | cardName, growthStage, cost, target |
| CardCancelled | 同上 |
| CardPlayFailed | 同上 + reason |
| PlantPlaced | cardName, position, direction, growthStage |
| EnemyDefeated | enemyName, turnNumber |
| RewardSelected | type, selected, choices |
| ShopBuy | itemType, itemName, cost |
| ShopExit | remainingGold |
| RestChoice | choice |
| TreasureCollected | itemName, itemType |
| StageEventSelected | eventId, choice |
| CultivationResult | cardName, fromStage, toStage |

## 未知イベントの扱い

仕様外イベントが将来増える可能性に備え、`safeParse` 失敗を `unknown_event` として記録し、
ingest を止めない方針。warn ログのみ。
