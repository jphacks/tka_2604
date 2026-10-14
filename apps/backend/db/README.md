# D1

Cloudflareアカウント `jphack-2026` 内で、検証用と本番用に別々のD1を使います。
どちらもHonoからは `c.env.DB` でアクセスできます。

| 環境            | Worker | D1                     | マイグレーション |
| --------------- | ------ | ---------------------- | ---------------- |
| develop（検証） | dev    | jphack-2026-develop-db | db/migrations    |
| main（本番）    | main   | jphack-2026-main-db    | db/migrations    |

以下のコマンドはリポジトリのルートで実行します。

```sh
# ローカルDBに適用（Cloudflare上のDBは変更しません）
npm run db:migrate:local
npm run dev

# Cloudflare上の検証DBに適用
npm run db:migrate:develop
npm run deploy:develop

# Cloudflare上の本番DBに適用
npm run db:migrate:main
npm run deploy:main
```

`npm run deploy` はdevelopを対象にします。
各デプロイコマンドは `npm run build` を実行してから公開します。
整形・lint・テストはデプロイ時には実行しません。
Wranglerの依存関係と起動・ビルド・デプロイ・DB操作・型生成コマンドはルートの `package.json` で管理します。
frontendはReact・Viteの依存関係とビルドを、backendはHonoの依存関係と型チェックを管理します。
SQLファイルと生成されたCloudflareの型はbackend内に置きます。
デプロイではDBマイグレーションは自動実行しません。
Gitブランチを切り替えても環境は自動で切り替わりません。コマンドで指定します。
ブランチへのpushによる自動デプロイは設定していません。

## マイグレーションの追加

`0001_init.sql` は空の雛形です。初回のスキーマを記入してから適用してください。
動作確認で作ったテスト用テーブルと適用履歴は削除済みです。
初回適用後は `0002_...sql` のように新しいファイルを追加できます。
適用済みのファイルは編集せず、変更は新しいファイルで行ってください。
各DBは適用履歴とデータを独立して保持します。
SQLは共通の `db/migrations/` に追加します。コマンドの `--env` で反映先を選び、同じSQLを検証後に本番へ適用します。
DBを必要とする新しいコードを公開する際は、対応するマイグレーションを先に適用してください。

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
