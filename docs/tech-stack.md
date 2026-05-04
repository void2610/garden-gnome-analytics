# 技術スタック詳細検討

前提: 静的 SPA + クライアントサイド DB（GitHub Pages へデプロイ可、サーバなし）。

以下は各レイヤごとに候補を比較し、本プロジェクトの要件に対して採否を判断したもの。

---

## 1. クライアントサイド DB / クエリエンジン

イベント数の見積り: 1 ラン平均 100〜500 行 × 数百ラン → 数万〜数十万行。今後の展示で 100 万行規模もありうる。**OLAP 集計が支配的**（カード使用率、ターン数中央値、ヒートマップ集計）。

| 候補 | アーキ | 強み | 弱み | 本件適合 |
| --- | --- | --- | --- | --- |
| **DuckDB-Wasm** | 列指向 + SQL | Parquet を HTTP Range で部分読込／GROUP BY・JOIN・ウィンドウ関数／集計が桁違いに速い／Arrow 連携 | 初期 wasm が ~10MB（gzip）／起動コスト | **◎ 第一候補** |
| SQL.js (SQLite/wasm) | 行指向 + SQL | バンドル小さい (~1MB)／枯れている | OLAP 集計が遅い／DB ファイル全体をメモリへ | △ 行数増えると劣化 |
| PGlite (Postgres/wasm) | 行指向 + SQL | フル PostgreSQL 互換／拡張が豊富 | 行指向で本件の集計には不向き／バンドル ~3MB | △ |
| Arquero | dplyr 風 JS API | 純 JS、wasm 不要、軽量／Observable 製で安定 | SQL ではない（学習要）／JOIN や複雑集計の表現力が DuckDB に劣る | ○ 補助的にはあり |
| AlaSQL | 純 JS SQL | JSON/CSV を直接クエリ | 大量データで明確に遅い | × |

**採用: DuckDB-Wasm**
- httpfs で `SELECT ... FROM 'public-data/events.parquet'` がそのまま走る
- パーティション Parquet (`event=*/device=*/data.parquet`) で predicate pushdown が効く
- Worker 実装で UI スレッドをブロックしない

参考: 同種の OSS ダッシュボード（Evidence.dev、MotherDuck UI、observablehq）はほぼ DuckDB-Wasm に収斂している。

---

## 2. データ保存形式（parser → webapp 間）

| 形式 | サイズ | DuckDB との相性 | 可読性 | 採否 |
| --- | --- | --- | --- | --- |
| **Parquet (zstd)** | ◎ 圧縮率高い | ◎ ネイティブ／HTTP Range | × バイナリ | **採用** |
| Arrow IPC | ○ | ◎ | × | 中間表現としてのみ |
| JSONL | × 大きい | ○ | ◎ | デバッグ用に併用 |
| CSV | △ | ○ | △ | 不採用 |
| SQLite ファイル | ○ | △（要 attach） | × | 不採用 |

**採用: Parquet（zstd）を本番、JSONL を `--dev` フラグで併出力**
- パーティショニング: `public-data/events/event=<slug>/device=<slug>/run=<runId>.parquet`
- サマリ系 (`runs.parquet`, `errors.parquet`) は単一ファイルで十分

書き出し手段: Node ingest CLI 内で **`duckdb` の Node バインディング**を使い `COPY (SELECT ...) TO '...parquet' (FORMAT PARQUET, COMPRESSION ZSTD)` を発行。`@dsnp/parquetjs` 等の純 JS ライタは保守状況が不安定なので避ける。

---

## 3. フロントエンドフレームワーク

| 候補 | DX | チャートライブラリの揃い | 型安全 | 本件適合 |
| --- | --- | --- | --- | --- |
| **React 19** | ○ | ◎ Recharts/visx/ECharts/Plot 全部使える | ◎ | **採用** |
| Solid | ◎（速い） | △ 公式チャート少ない | ◎ | × |
| Svelte 5 / SvelteKit | ◎ | ○ | ○ | × |
| Vue 3 | ○ | ○ | ○ | × |

**採用: React 19**
- 個人開発の生産性ではなく**ライブラリの選択肢**で決める。データ可視化系の OSS は React 前提が圧倒的に多い。
- Concurrent feature（`useDeferredValue`、`useTransition`）が大量データのフィルタ UI で活きる。

---

## 4. ビルド／開発ツール

| 候補 | 採否 | 備考 |
| --- | --- | --- |
| **Vite 5** | **採用** | 軽量、HMR 高速、`vite build` で純粋な静的アセット |
| Next.js (static export) | × | SSR/RSC の旨味が静的では出ない／設定の重さに見合わない |
| Astro | × | islands は本件のような全画面インタラクティブには向かない |
| Parcel / Rsbuild | × | Vite のエコシステムから離れる理由がない |

`base: '/garden-gnome-analytics/'` を設定して GitHub Pages のサブパスに対応。

---

## 5. ルーティング

| 候補 | 型安全 search params | 採否 |
| --- | --- | --- |
| **TanStack Router** | ◎ Zod スキーマ統合 | **採用** |
| React Router v7 | △ 自前 | × |
| Wouter | × | × |

**採用理由**: 本アプリの状態は「フィルタ条件」と「選択中ラン ID」が中心で、それらは URL で共有・ブックマーク可能であるべき。TanStack Router は `validateSearch: zodValidator(schema)` で URL パラメータを型安全に扱える。

---

## 6. 状態管理 / データ取得

| 役割 | 採用 | 理由 |
| --- | --- | --- |
| 非同期クエリ結果 | **TanStack Query** | DuckDB クエリのキャッシュ・dedupe・staleness 管理 |
| URL フィルタ状態 | **TanStack Router search params** | リロード／共有で状態が保持される |
| ローカル UI 状態 | React `useState` / `useReducer` のみ | グローバルストアは不要 |

Zustand / Jotai は今のところ不要。複雑化したら Jotai を検討（atom 単位の派生計算が分析 UI と相性◎）。

---

## 7. UI ライブラリ／スタイリング

| 候補 | コンポーネント網羅 | データテーブル | カスタマイズ性 | 開発速度 |
| --- | --- | --- | --- | --- |
| **Mantine v7** | ◎（タブ、ドロワ、日付、Notification 全部入り） | ◎ Mantine React Table（TanStack Table 拡張） | ○ | **◎** |
| shadcn/ui + Tailwind + TanStack Table | ○（コピペで増やす） | △ 自前組立 | ◎ | ○ |
| Chakra v3 | ○ | △ | ○ | ○ |
| Park UI / Ark UI | △ headless | △ | ◎ | △ |

**採用: Mantine v7**
- 個人開発・分析用途で**書く量を最小化**したい。Mantine は日付ピッカー・MultiSelect・通知・モーダル・スポットライト検索など分析 UI 必須部品が揃う。
- ダークモード切替、charts パッケージ、hooks パッケージなど周辺も充実。
- shadcn/ui の方が見た目の自由度は高いが、本件は**機能 > 見た目**。

スタイル補助に Tailwind を併用するかは保留。Mantine 単独で大半が済むので、最初は Mantine の `style props` のみで進める。

---

## 8. チャートライブラリ

用途別に**複数併用**が現実解。

| ライブラリ | レンダリング | 強み | 採否 |
| --- | --- | --- | --- |
| **Observable Plot** | SVG | grammar of graphics、宣言的、コード量少／heatmap・cell・rect が標準 | **採用（主力）** |
| **ECharts (echarts-for-react)** | Canvas | 大規模点群、ヒートマップ、複雑インタラクションに強い | **採用（重い描画用）** |
| Recharts | SVG | React フレンドリー、簡単 | × Plot で代替可 |
| visx | SVG (低レベル) | 完全カスタム可能 | × オーバーヘッド大 |
| @mantine/charts | SVG (Recharts ラップ) | Mantine と統一感 | △ 補助で使える |
| deck.gl | WebGL | 巨大データセットの地理的描画 | × ここでは不要 |
| Plotly.js | SVG/WebGL | 多機能だが重い | × |

**役割分担案**
- 折れ線・棒・分布・ヒストグラム → **Observable Plot**（`Plot.lineY`, `Plot.barY`, `Plot.rectY`）
- マップヒートマップ（PlayerMoved/PlantPlaced 集計）→ **ECharts heatmap series**（canvas でズーム時のレンダ性能が安定）
- ラン詳細のスパークライン → `@mantine/charts` でも可

---

## 9. テーブル

| 候補 | 採否 |
| --- | --- |
| **TanStack Table v8（headless）** | **採用** |
| Mantine React Table | 上記をラップした Mantine 版／**併用採用**（一覧画面はこちらで省力化） |
| AG Grid Community | × ライセンス考慮ノイズ／SPA に重い |

ラン一覧などは Mantine React Table で即組み、特殊な集計テーブルは TanStack Table を直接叩く。

---

## 10. 型／バリデーション

| 用途 | 採用 |
| --- | --- |
| meta.yaml の検証 | **Zod** |
| URL search params の検証 | **Zod**（TanStack Router 連携） |
| parser の出力スキーマ | **Zod** + 型推論 (`z.infer`) |
| イベント種別の Discriminated Union | Zod の `z.discriminatedUnion` |

Valibot は bundle が小さく魅力的だが、TanStack Router 連携や周辺事例の多さで Zod を採る。

---

## 11. パーサ／取り込み CLI（packages/parser）

| 役割 | 採用 |
| --- | --- |
| 実行ランタイム | **Node.js 20 + tsx**（本番ビルドは tsup で単一ファイル化） |
| ファイル走査 | **fast-glob** |
| YAML 読込 | **yaml**（eemeli/yaml） |
| 行パース | 自前実装（pipe split → key=value 分解 → Zod バリデーション） |
| ストリーム処理 | Node の `readline` で line-by-line |
| Parquet 書き出し | **`duckdb` Node バインディング**（`COPY ... TO ... (FORMAT PARQUET)`） |
| ロギング | **pino**（CLI 進捗表示） |
| 単体テスト | **Vitest** + サンプル log fixture |

CLI コマンド設計案:
```bash
pnpm ingest [--data-dir data] [--out public-data] [--dev]
pnpm ingest:watch    # 開発時、data/ の変化を監視
```

---

## 12. パッケージマネージャ／モノレポ

| 候補 | 採否 |
| --- | --- |
| **pnpm workspaces** | **採用**（高速、ディスク効率、ロックファイル安定） |
| npm workspaces | × フィールドサポートに穴がある |
| Bun workspaces | × 一部 native deps（duckdb）で不安定報告あり |
| Yarn berry | × 設定コスト過多 |

ルート `package.json` に `packages/*` を登録、`pnpm -F parser ingest` 等で実行。

---

## 13. テスト

| レイヤ | 採用 |
| --- | --- |
| parser 単体テスト | **Vitest**（fixture log → Parquet 検査） |
| webapp ロジック（純関数） | **Vitest** |
| webapp コンポーネント | 当面なし（個人開発・スコープ小） |
| E2E | 当面なし |

---

## 14. CI / デプロイ

| 段階 | ツール |
| --- | --- |
| Lint | **Biome**（ESLint+Prettier 一体型、Vite と相性◎、設定 1 ファイル） |
| 型チェック | tsc --noEmit |
| ビルド | GitHub Actions: `pnpm install && pnpm -F parser ingest && pnpm -F webapp build` |
| デプロイ | GitHub Pages（`actions/deploy-pages`） |
| データ更新フロー | 生ログを **Git LFS** か **GitHub Releases assets** に置く（後述） |

ESLint/Prettier の代わりに **Biome** を使うのは、設定の単純化と速度のため。Mantine も React 19 も Biome で問題なく回る。

### 生ログの取り扱い

| 方式 | サイズ耐性 | コスト | 共有性 | 採否 |
| --- | --- | --- | --- | --- |
| Git に直接コミット | × 100MB 制限 | 無料 | ◎ | × |
| **Git LFS** | ○ | 帯域 1GB/月まで無料 | ◎ | **第一候補** |
| GitHub Releases に zip 添付 | ○ | 無料 | ○ | 候補 |
| 外部 (R2/S3/Drive) | ◎ | 月額 | △ | 不採用 |
| ローカルのみ（公開しない） | ◎ | 無料 | × | 採用 (デフォルト) |

**結論**: 生ログは `data/` 以下にローカル保持（gitignore）。**生成済み Parquet** は `public-data/` にコミット（数 MB 程度に収まる見込み）。生ログ自体を共有したい場合のみ Git LFS を有効化。

---

## 15. 最終スタック一覧（採用案）

```
言語         : TypeScript 5.x
モノレポ     : pnpm workspaces
共通         : Zod, date-fns, Vitest, Biome

[parser]
  Node 20 + tsx / tsup
  fast-glob, yaml, pino, duckdb (Node bindings)
  → Parquet (zstd) を public-data/ に出力

[webapp]
  Vite 5 + React 19 + TypeScript
  TanStack Router (search params に Zod)
  TanStack Query
  DuckDB-Wasm (Web Worker)
  Mantine v7 (+ Mantine React Table, @mantine/charts)
  Observable Plot (主力チャート)
  ECharts for React (heatmap など重い描画)

[CI/CD]
  GitHub Actions
  GitHub Pages (actions/deploy-pages)
  生ログは Git LFS（必要に応じて有効化）
```

---

## 16. 主要な意思決定の根拠サマリ

1. **DuckDB-Wasm**: 集計が支配的なワークロード、Parquet を HTTP Range で読める、SQL で書ける生産性。
2. **Parquet (zstd)**: 圧縮効率と DuckDB ネイティブ対応。
3. **React + Vite**: チャートライブラリ選択肢の広さで他フレームワークを上回る。
4. **TanStack Router**: フィルタ状態を URL に乗せて型安全に扱える。
5. **Mantine v7**: 分析 UI に必要なコンポーネントが揃い、書く量が最小。
6. **Observable Plot + ECharts**: 主力は宣言的な Plot、重い描画のみ Canvas の ECharts。
7. **Zod**: meta.yaml・URL・parser スキーマの一気通貫。
8. **pnpm workspaces**: parser と webapp の monorepo 管理に必要十分。

---

## 17. 未決事項

- Mantine か shadcn/ui かは見た目の好みが入る。`@mantine/core` を試作で評価し、不満があれば shadcn 切替（移行コストはコンポーネント単位で局所的）。
- ヒートマップ密度次第で ECharts ではなく **deck.gl + GPU 集計** に乗せ替える可能性あり（PlayerMoved が爆発的に増えた場合のみ）。
- パーティション粒度（`event/device/run` の三段か、`event/device` の二段か）は実データ容量を見て調整。
