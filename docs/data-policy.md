# データ取り扱いポリシー

## 生ログ (`data/`)

- **コミットしない**。`.gitignore` で除外。
- 例外として `meta.yaml` のみ git 管理。
- ローカルから ingest を実行し、生成 Parquet をコミットする運用。

## 生成済み Parquet (`public-data/`)

- **コミット対象**。webapp が直接 fetch する。
- サイズが妥当（数 MB 程度）な範囲ではこの方針を維持。
- 100MB を超えたら Git LFS、または GitHub Releases assets への切替を検討。

## 個人情報

- 生ログ内の `persistentDataPath` 等にユーザー名やパスが含まれることがあるが、
  webapp が読む `events.parquet` 等の正規化先には**ユーザー固有のパス情報は含めない**。
  ingest 時に payload を JSON 文字列として保存しているが、これは run ログ由来の
  ゲーム内パラメータのみ。
- 通常ログから抽出するエラー `message` は内容次第でユーザー名を含む可能性があるため、
  公開前に内容を点検する。

## 生ログを共有したい場合

- Git LFS を有効化するか、GitHub Releases に zip で添付する。
- 外部ストレージへ置くのは選択肢から外している（運用コスト）。

## 運用フロー

1. 展示で取得した生ログを `data/<event>/<device>/` に配置（`meta.yaml` 作成）
2. `pnpm ingest` で `public-data/` を更新
3. `git commit` & `git push` → GitHub Actions が GitHub Pages を再デプロイ
