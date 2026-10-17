# APIドキュメント

OpenAPI 3.1.0の仕様を`apps/backend/docs/api/openapi.json`に手書きで管理する。APIは通常のHonoの`app.get()`・`app.post()`で実装し、入力のあるAPIではZodで検証する。Hono RPCの型は実装から公開する。

APIを変更するときは実装・OpenAPI仕様・APIの動作テストを同じ変更で更新する。OpenAPIの自動生成は行わない。`apps/backend/src/openapi.ts`は仕様JSONの読み込みとSwagger UIの設定だけを担当する。

イベント本体の一覧・作成・詳細取得・設定更新・論理削除は[イベントAPI](events.md)を参照。認証接続前はRoute内の仮ID定数`demo-owner`を所有者として渡し、#57で認証済みIDへ置き換える。環境変数の設定は不要。

表・制約・チャット履歴は、それぞれ`GET /api/events/{eventId}/schedule`・`/constraints`・`/chat`で取得する。契約・具体例・並び順は[イベントAPI](events.md)にまとめる。チャットはページング・件数上限なしで保存済み全履歴を返す。

`GET /api/health`は入力なしで200と`{"status":"ok"}`を返す。DBの稼働確認は含まない。イベント本体と3種類の情報取得を実装済み。表・制約は同じパスのPOSTで個別保存する。認証・計算APIは後続Issueで扱う。

BE ↔ Solverの契約案は[BE - Solver API設計](<../BE - Solver API設計.md>)を参照。リクエスト・レスポンス例と探索状態を記載している。未実装のため、現在配信するOpenAPIには含めない。

## Markdown定義書の共通形式

MarkdownのAPI定義書は[共通テンプレート](template.md)を使い、次の順番で書く。

| 順番 | 見出し             | 記載内容                                                       |
| ---- | ------------------ | -------------------------------------------------------------- |
| 1    | 概要               | 目的・利用場面・処理の要約。提案か実装済みかも明記             |
| 2    | API仕様            | エンドポイント・HTTPメソッド・パラメータ・形式・認証を表にする |
| 3    | リクエスト         | 実際に送る具体例と、必要な補足                                 |
| 4    | レスポンス         | HTTPステータスと、正常／エラーの具体例                         |
| 5    | 懸念点・未決定事項 | 未確定の仕様や失敗・競合時の懸念。なければ「なし」             |

リクエスト例はリクエスト欄、レスポンス例とエラー例はレスポンス欄へまとめる。GETなどリクエストボディがない場合も欄を省かず「ボディなし」と書く。1資料で複数APIを扱う場合はAPIごとに小見出しを設け、入出力の対応を明確にする。

具体例を中心に簡潔に書き、細かなフィールド表は必要な場合だけ追加する。資料の対象となる通信区間を明記し、別区間のAPIや保存フローを混在させない。

制約JSONの正本は`apps/schema`を参照し、説明用の別スキーマを作らない。実装済みの契約はMarkdownと`openapi.json`へ揃え、検討資料と混同しない。

## developで共有・試行

既存のdevelopドメインで次のパスを配信する。URLを共有すれば、閲覧するメンバーのPCで開発環境を起動する必要はない。

- [Swagger UI](https://dev.jphack-2026.workers.dev/api/docs)：`GET /api/health`を展開し、`Try it out` → `Execute`で200と応答を確認する。
- [OpenAPI JSON](https://dev.jphack-2026.workers.dev/api/openapi.json)：手書きで管理するAPI仕様。

OpenAPIの`servers`は`/`、UIが読み込む仕様は`/api/openapi.json`とし、UI・JSON・APIを同じdevelopドメインから提供する。localhostへの接続や別オリジンへのCORS許可は不要。Swagger UIのJS/CSSはバージョンを固定したCDNから取得する。

## ローカル開発とdevelopへの公開

リポジトリルートで`npm run dev`を実行すると、`http://localhost:8787/api/docs`で同じUIを確認できる。

```sh
npm run check
npm run deploy:develop
```

公開は依頼がある場合に実行する。コマンドは画面のビルド後にdevelopのWorkerへ公開する。DBマイグレーション・mainへのデプロイは含まない。公開後は表示されたdevelopドメインでUI・JSON・healthの200・未知のAPIのJSON 404・既存アプリの画面を確認する。

## 更新と確認

1. `apps/backend/docs/api/openapi.json`でパス・メソッド・入出力・ステータス・説明を更新する。
2. 通常のHonoルートとZodの入力検証を実装し、対象APIのテストを追加・更新する。
3. 次を実行し、Swagger UIでも表示とAPIの試行を確認する。

```sh
npm run test:backend
npm run check
```

healthはVitestでステータス200・Content-Type・応答本文を直接確認し、`test/openapi.test.ts`では手書きOpenAPIの応答スキーマにも照合する。共通補助処理は`test/helpers/openapi.ts`。契約テストではAjvのJSON Schema 2020-12用クラスを使う。AjvはOpenAPIの契約テスト専用の開発依存とする。保存済みConstraintの実行時検証は、共有JSON Schemaを参照するZodの共通処理で行う。

```ts
const response = await app.request('/api/health')
await expectJsonResponse(
  response,
  openApiDocument.paths['/api/health'].get.responses,
)
```

必須項目の欠落・型・enum・仕様にないステータス・Content-Typeを拒否し、仕様側だけを変更しても不一致を検出する。仕様JSONの配信テストやRPCの型検査とは役割が異なる。

現状の補助処理は、呼び出し側が選んだ操作の明示的なステータスと、インラインのJSON応答スキーマと同一文書内の`components.schemas`参照を対象にする。全APIの自動走査、入力・認証・権限、`default`応答、OpenAPI文書全体の検証は行わない。`components`参照はイベント情報取得の契約テストで解決し、ネストした不正Constraintも拒否する。外部参照や`format`の追加時は解決・検証方法とテストを用意する。他のAPIの追加時も、入力・成功・エラーの動作テストと契約テストを揃え、仕様のレビューを続ける。

Vitestでhealth・404・仕様JSONの配信・Swagger UIのHTML・共有ドメインでの接続を確認する。Hono RPCの`AppType`はルート登録の返り値から公開し、`hc<AppType>()`でのhealth呼び出しと応答型をテストする。`expectTypeOf`の確認は`npm run typecheck`で行う。frontendのRepositoryへの接続は今後行う。
