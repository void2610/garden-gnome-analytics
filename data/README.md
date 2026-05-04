# data/

生ログ置き場。`<event>/<device>/` の階層で配置する。

```
data/
└── <event-slug>/
    └── <device-slug>/
        ├── meta.yaml         # ← これだけ git 管理
        ├── run_*.log
        └── the-garden-of-garden-gnome_*.log
```

`meta.yaml` 例:

```yaml
event: ゲムダン12 デモ展示
event_date: 2026-05-03
venue: 〇〇会場
device: MacBook Pro 14" M3
game_version: 0.2.x
notes: 来場者層は学生中心。
```
