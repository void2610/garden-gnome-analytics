# イベント / 取り込み設定

ingest CLI が参照する設定ファイル類のリファレンス。
新しいイベントを追加する / 既存イベントの分析対象を絞る ときに編集する。

## ディレクトリ構成

```
data/
├── <event-slug>/
│   ├── event.yaml            ← イベント単位のメタ (任意)
│   └── <device-slug>/
│       ├── meta.yaml         ← 機器単位のメタ (必須)
│       ├── run_*.log
│       └── the-garden-of-garden-gnome_*.log
config/
└── exclude_errors.yaml       ← 全イベント共通のエラー除外設定 (任意)
```

`data/` は基本 gitignore だが、以下だけ git 管理する:

- `data/**/meta.yaml`
- `data/*/event.yaml`

## `meta.yaml` (機器単位、必須)

```yaml
event: ゲムダン12 デモ展示       # 表示名 (event.yaml.name で上書き可)
event_date: 2026-05-03
venue: ゲムダン12 会場
device: MacBook Pro 14"          # 表示名 (機器単位で必須)
game_version: 0.2.x
notes: MacBook Pro 14" 機材での収録ログ  # 機器固有メモ
slug:                            # 任意で slug を上書き
  event: gemudan12-demo-2026-05
  device: macbook-pro
```

`event_slug` / `device_slug` は `slug.event` / `slug.device` が無ければディレクトリ名から
slugify された値が使われる。

## `event.yaml` (イベント単位、任意)

同一イベント (= `data/<event-slug>/`) の全機器に紐付くメタ情報。
存在しなければ無視される。

```yaml
# 表示名 (省略時は配下の meta.yaml の event を使う)
name: ゲムダン12 デモ展示

# イベント詳細ページに本文として表示される説明 (改行保持)
description: |
  ターンエンドボタンのタイミングにより進行不能になるバグがあった。
  20回くらい強制終了した気がする

# slug の上書き (meta.yaml.slug.event より優先)
slug: gemudan12-demo-2026-05

# 開催時間帯 (JST, 半開区間 [start, end))。
# started_at がこの範囲外のランは "開発者テスト" とみなして
# ingest 時に events / runs / errors すべてが除外される。
play_hours:
  start: "11:00"
  end: "17:00"
```

### `play_hours` の挙動

- `started_at` (UTC) を JST に変換した時刻で判定する。
- run の出力をスキップするのに加え、その run 範囲内のエラー、および run に紐付かない
  orphan エラーログのうち時間帯外のものも除外する。
- 設定変更後は `pnpm ingest --clean` を流して `public-data/` を再生成する必要がある。

## `config/exclude_errors.yaml` (全イベント共通、任意)

normal log の Error / Exception レベルで、`message` にここで列挙した文字列を 1 つでも
含むエントリを ingest 時にスキップする (部分一致, case-sensitive)。
常時発生する環境依存のノイズログを analytics から除くために使う。

```yaml
patterns:
  - "Failed to update rich presence"
  - "[Steamworks.NET] SteamAPI_Init() failed."
```

CLI から別パスを指定したい場合は `--exclude-config <path>` を渡す。
ファイルが存在しなければ除外なしで動作する (警告は出さない)。

## 設定変更後の再取り込み

設定変更が `public-data/` の中身に影響する場合、以下を流して反映する:

```bash
pnpm ingest --clean
pnpm fetch-localization   # --clean で消えた localization.json を再取得
```

`--clean` を付けないと旧 parquet が残るので、機器構成や run 数が変わるときは付けること。
