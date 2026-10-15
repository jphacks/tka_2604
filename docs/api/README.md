# APIドキュメント

OpenAPI 3.1.0の仕様を`docs/api/openapi.json`に手書きで管理する。APIは通常のHonoの`app.get()`・`app.post()`で実装し、入力のあるAPIではZodで検証する。Hono RPCの型は実装から公開する。

APIを変更するときは実装・OpenAPI仕様・契約を確認するテストを同じ変更で更新する。OpenAPIの自動生成は行わない。`apps/backend/src/openapi.ts`は仕様JSONの読み込みとSwagger UIの設定だけを担当する。

現在のAPIは`GET /api/health`のみ。入力はなく、200で`{"status":"ok"}`を返す。DBの稼働確認は含まない。イベント・認証・制約・計算APIは未実装。

## developで共有・試行

既存のdevelopドメインで次のパスを配信する。URLを共有すれば、閲覧するメンバーのPCで開発環境を起動する必要はない。

- [Swagger UI](https://dev.jphack-2026.workers.dev/api/docs)：`GET /api/health`を展開し、`Try it out` → `Execute`で200と応答を確認する。
- [OpenAPI JSON](https://dev.jphack-2026.workers.dev/api/openapi.json)：手書きで管理するAPI仕様。

OpenAPIの`servers`は`/`、UIが読み込む仕様は`/api/openapi.json`とし、UI・JSON・APIを同じdevelopドメインから提供する。localhostへの接続や別オリジンへのCORS許可は不要。Swagger UIのJS/CSSはバージョンを固定したCDNから取得する。

## ローカル開発とdevelopへの公開

リポジトリルートで`npm run dev`を実行すると、`http://localhost:8787/api/docs`で同じUIを確認できる。Live Server用HTMLは用意しない。

```sh
npm run check
npm run deploy:develop
```

公開は依頼がある場合に実行する。コマンドは画面のビルド後にdevelopのWorkerへ公開する。DBマイグレーション・mainへのデプロイは含まない。公開後は表示されたdevelopドメインでUI・JSON・healthの200・未知のAPIのJSON 404・既存アプリの画面を確認する。

## 更新と確認

1. `docs/api/openapi.json`でパス・メソッド・入出力・ステータス・説明を更新する。
2. 通常のHonoルートとZodの入力検証を実装し、対象APIのテストを追加・更新する。
3. 次を実行し、Swagger UIでも表示とAPIの試行を確認する。

```sh
npm run test:backend
npm run check
```

healthの契約テストは、OpenAPIに記載したGET操作・200・Content-Typeを実レスポンスと照合し、応答JSONを仕様のJSON Schemaで検証する。JSON Schemaの検証にはテスト用のAjvを使用し、API実行時の依存には含めない。他のAPIを追加するときは対象の入力・成功・エラーの契約テストも追加する。現在のテストが未実装APIまで保証するとは扱わない。

Vitestでhealth・404・仕様JSONの配信・Swagger UIのHTML・共有ドメインでの接続を確認する。Hono RPCの`AppType`はルート登録の返り値から公開し、`hc<AppType>()`でのhealth呼び出しと応答型をテストする。`expectTypeOf`の確認は`npm run typecheck`で行う。frontendのRepositoryへの接続は今後行う。
