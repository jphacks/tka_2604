# D1・Drizzleの開発手順

以下はすべてリポジトリルートで実行する。検証用と本番用は別D1。通常の開発・テストではローカルDBだけを使う。

| 環境    | Worker | D1                     | SQLの配置                  |
| ------- | ------ | ---------------------- | -------------------------- |
| develop | dev    | jphack-2026-develop-db | apps/backend/db/migrations |
| main    | main   | jphack-2026-main-db    | apps/backend/db/migrations |

## schemaはどこを編集するか

`apps/backend/src/db/schema.ts`がDrizzleのDB定義。テーブル・カラム・外部キー・一意制約・CHECKを記述する。取得・挿入のTypeScript型はDrizzleの`$inferSelect`・`$inferInsert`から導く。APIの入力型や制約JSONの正本とは分ける。

`apps/backend/drizzle.config.ts`でSQLite方言・schemaの場所・生成先を指定する。DBへの接続情報やトークンは不要。`apps/schema`は制約JSONの形式を管理する場所で、DB定義は置かない。

## migrationをどう進めるか

1. `schema.ts`を編集する。
2. 次のコマンドでSQLを生成する。生成時点ではDBを変更しない。

```sh
npm run db:generate -- --name=add_example
```

3. `apps/backend/db/migrations/`に追加されたSQLと`meta/`の差分を確認する。SQL・スナップショット・journalを一緒にGit管理する。
4. ローカルへ適用し、保存・再取得・エラー時の動作をテストする。

```sh
npm run db:migrate:local
npm run test:backend
npm run check
```

SQL適用と適用履歴の管理はWranglerが担当する。Drizzleの`push`でDBへ直接反映したり、DrizzleのmigrateとWranglerで履歴を二重管理したりしない。

現在の初回migrationは`0000_business_tables.sql`（8テーブル）と`0001_event_integrity.sql`（同一イベントの保証・部削除のトリガー）。空だった`0001_init.sql`は未適用の雛形として除去した。適用済みmigrationは書き換えず、変更は新規ファイルで追加する。

### トリガーなど生成対象外のSQL

Drizzleのテーブル定義だけで表現できないルールはカスタムmigrationへ書く。

```sh
npm run db:generate -- --custom --name=add_example_trigger
```

このコマンドで作られた空のSQLに処理を書く。自動生成されたテーブルSQLやmetaは手編集しない。DBテストでは自動生成SQLとカスタムSQLの両方を適用する。

## ローカル確認用データ

```sh
npm run db:migrate:local
npm run db:seed:local
npm run dev
```

seedは`demo-`で始まるUser・Event・2部・3バンド・同名別人・掛け持ち・未配置バンド・制約を追加する。第2部は空。再実行は既存データを上書きしないため、編集したデモデータのリセットにはならない。

Userのhashはログインできないダミー値。認証・業務API・frontendのRepositoryはまだ接続していないため、このデータを入れても画面は既存モックのまま。HTTPのhealthはDBの疎通確認ではない。

### 空のローカルDBで作り直す

既存の開発DBを消さず、保存先を新しい一時ディレクトリへ切り替える。

```sh
db_state=$(mktemp -d)
npm run db:migrate:local -- --persist-to "$db_state"
npm run db:seed:local -- --persist-to "$db_state"
npm run dev:backend -- --persist-to "$db_state"
```

通常の保存先は`.wrangler/state/v3/d1`。上記はその既存データを変更しない。ブランチ切替ではDBは切り替わらず、通常の開発コマンドは共通のローカルDBを使う。

## DB結合テスト

```sh
npm run test:backend
```

既存Wranglerの`getPlatformProxy`からMiniflareの実D1 bindingを取得する。設定は`apps/backend/test/wrangler.jsonc`で、リモート用ID・assets・本番設定は使わない。`persist: false`で各テストを空のDBから開始し、全migrationをファイル名順に適用する。`remoteBindings: false`・テスト専用の設定ディレクトリ・`envFiles: []`でリモートDBや通常の開発設定から分離し、テスト終了時にdisposeする。通常の開発DBは使わない。

テストは`apps/backend/src/db/*.test.ts`、初期化は`apps/backend/src/test/database.ts`。Vitestのbackend projectとして`npm run check`・pre-commit・既存CIに含む。モックD1ではなく、Drizzle経由の保存・再取得、DBの拒否、batch失敗時のロールバック、保存競合を確認する。

## リモートへの適用・公開

以下は明示的に依頼されたときに実行する。今回の実装では実行していない。

```sh
npm run db:migrate:develop
npm run deploy:develop

npm run db:migrate:main
npm run deploy:main
```

SQLは環境共通で、各DBが適用履歴を独立管理する。必要なmigrationを先に適用してから、それを使うコードを公開する。デプロイはmigrationを自動適用しない。各deployコマンドのbuildにはテストが含まれないため、事前にcheckを行う。pushによる自動デプロイは未設定。

Drizzle Kitの間接依存`@esbuild-kit/core-utils`が使うesbuildだけを、既存Wranglerと同じ`0.28.2`へoverrideしている。古いesbuildの既知の脆弱性を避けるためで、KitのSQL生成と全チェックで互換性を確認する。Kit更新時に不要になればoverrideを削除する。

## URLとメンバー招待

Cloudflareの `workers.dev` URLで公開します。frontendとbackendは同じWorkerで配信します。

| 環境            | frontend                             | backendの疎通確認                               |
| --------------- | ------------------------------------ | ----------------------------------------------- |
| develop（検証） | https://dev.jphack-2026.workers.dev  | https://dev.jphack-2026.workers.dev/api/health  |
| main（本番）    | https://main.jphack-2026.workers.dev | https://main.jphack-2026.workers.dev/api/health |

アカウントのWorkersサブドメインは `jphack-2026`、Worker名は検証用が `dev`、本番用が `main` です。
独自ドメインは後から追加・変更できます。
アカウントの「Manage account → Members → Invite members」からメンバーを招待できます。
招待先に応じた権限を選択してください。

参考：[Drizzle KitのSQL生成](https://orm.drizzle.team/docs/drizzle-kit-generate)、[D1のmigration](https://developers.cloudflare.com/d1/reference/migrations/)、[D1 batchの原子性](https://developers.cloudflare.com/d1/worker-api/d1-database/#batch)。
