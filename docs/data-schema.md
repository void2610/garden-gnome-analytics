# データスキーマ

ingest CLI が `public-data/` 配下に書き出す Parquet 群の仕様。

## ファイル配置

```
public-data/
├── manifest.json
├── events/
│   └── event=<slug>/device=<slug>/data.parquet
├── runs/
│   └── event=<slug>/device=<slug>/data.parquet
└── errors/
    └── event=<slug>/device=<slug>/data.parquet
```

## events.parquet

| 列 | 型 | 説明 |
| --- | --- | --- |
| event_slug | VARCHAR | イベント slug |
| device_slug | VARCHAR | 機器 slug |
| run_id | VARCHAR | run ファイル名（拡張子なし） |
| seq | INTEGER | 1 ラン内の連番 (0-based) |
| timestamp | TIMESTAMP | ローカル時刻 |
| event_type | VARCHAR | イベント種別 |
| payload | VARCHAR | 残りパラメータの JSON |
| game_version | VARCHAR | meta.yaml の game_version |

## runs.parquet

| 列 | 型 | 説明 |
| --- | --- | --- |
| run_id | VARCHAR | |
| event_slug, device_slug | VARCHAR | |
| started_at, ended_at | TIMESTAMP | |
| duration_sec | DOUBLE | |
| stage_count | INTEGER | StageEnter 数 |
| battle_win_count | INTEGER | BattleWin 数 |
| battle_loss_count | INTEGER | BattleLose または HP=0 数 |
| final_hp / max_hp | INTEGER | |
| final_deck_size | INTEGER | 最終 BattleStart の deckCards 件数 |
| outcome | VARCHAR | win / loss / abandoned |
| game_version | VARCHAR | |

## errors.parquet

| 列 | 型 | 説明 |
| --- | --- | --- |
| event_slug, device_slug | VARCHAR | |
| run_id | VARCHAR | run 範囲外なら NULL |
| timestamp | TIMESTAMP | |
| level | VARCHAR | Error / Exception |
| message | VARCHAR | |
| stack_trace | VARCHAR | 任意 |

## manifest.json

```jsonc
{
  "generatedAt": "ISO8601",
  "datasets": [
    {
      "eventSlug": "...",
      "deviceSlug": "...",
      "meta": { /* meta.yaml の中身 */ },
      "runCount": 0,
      "eventCount": 0,
      "errorCount": 0,
      "period": { "from": "ISO8601", "to": "ISO8601" }
    }
  ]
}
```
