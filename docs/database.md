# DB方針（未実装）

Cloudflare D1 / Drizzleを採用予定。現在は依存関係、テーブル、D1 bindingとも未導入。

## 保存対象の候補

イベント、バンド・出演者と所属、制約、出演順。ユーザー・フォーム・チャット履歴の保存範囲は対応Issueで決める。

## 定義と生成

`apps/backend/src/db/schema.ts`のDrizzle定義からSQLマイグレーションと取得・挿入の型を導く予定。SQLは`apps/backend/drizzle/`でGit管理する。制約JSONの正本は[apps/schema](../apps/schema)に置き、DB定義とは分ける。

導入時に接続設定、ローカルDB準備、生成・適用コマンドを追記する。`wrangler types`はbindingの型を生成するもので、テーブルの型やJSON内容の検証を代替しない。

## 変更時

定義変更 → SQL生成・差分確認 → ローカル適用・確認。本番DBへの適用は別途確認する。デモはダミーデータを使い、初期化手順は実装時に追記する。
