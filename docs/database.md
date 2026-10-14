# DB方針

Cloudflare D1のbindingは導入済み。developとmainに独立したDBを用意し、どちらもHonoから `c.env.DB` でアクセスする。Drizzleと業務テーブルは未導入。

## 保存対象の候補

イベント、バンド・出演者と所属、制約、出演順。ユーザー・フォーム・チャット履歴の保存範囲は対応Issueで決める。

## 定義と生成

`apps/backend/src/db/schema.ts`のDrizzle定義からSQLマイグレーションと取得・挿入の型を導く予定。現在のSQLは共通の `apps/backend/db/migrations/` でGit管理し、適用先は環境別のコマンドで切り替える。制約JSONの正本は[apps/schema](../apps/schema)に置き、DB定義とは分ける。

適用コマンドと環境設定は[DB手順](../apps/backend/db/README.md)を参照。`0001_init.sql`は空の雛形なので、初回のスキーマを記入してから適用する。`wrangler types`はbindingの型を生成するもので、テーブルの型やJSON内容の検証を代替しない。

## 変更時

定義変更 → SQL生成・差分確認 → ローカル適用・確認。本番DBへの適用は別途確認する。デモはダミーデータを使い、初期化手順は実装時に追記する。
