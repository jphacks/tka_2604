# 構成・技術選定

## 技術選定

| 用途                   | 技術                                                               | 状態・理由                                                     |
| ---------------------- | ------------------------------------------------------------------ | -------------------------------------------------------------- |
| フロントエンド         | React / TypeScript / Vite / Tailwind CSS / React Router / dnd-kit  | 導入済み。画面を素早く実装する                                 |
| API・配信              | Hono / Cloudflare Workers                                          | 導入済み。TypeScriptでAPIと画面配信をまとめる                  |
| API入力検証・仕様      | Zod / OpenAPI                                                      | イベント本体APIにZod導入済み。OpenAPIは別JSONで管理            |
| FE・BEの型共有         | Hono RPC                                                           | 既存イベントAPIへfrontendのRepositoryから接続済み（APIモード） |
| APIドキュメント閲覧    | Swagger UI                                                         | 導入済み。developドメインで仕様を共有・APIを試行する           |
| 制約の共有             | JSON Schema / json-schema-to-typescript / datamodel-code-generator | 導入済み。TypeScriptとPythonのモデルを同じ定義から生成する     |
| Python環境・入力モデル | uv / Pydantic                                                      | 導入済み。依存管理と構造化データの検証                         |
| 最適化API              | FastAPI / OR-Tools CP-SAT / Vercel                                 | 疎通確認済み（#26）。順序・間隔の制約をPythonで扱う            |
| 保存                   | Cloudflare D1 / Drizzle                                            | 導入済み。イベント本体APIから保存・再取得を接続済み            |
| テスト                 | Vitest / Testing Library / Playwright                              | 導入済み。frontend・backendの振る舞いを確認する                |
| LLM                    | OpenAI Responses API / GPT-6 Luna（effort: low）                   | 採用方針を合意済み。接続は#31                                  |
| ソルバー公開先         | 未確定                                                             | 対応Issueで決める                                              |

## 配置

| 場所            | 責務・状態                                                                           |
| --------------- | ------------------------------------------------------------------------------------ |
| `apps/frontend` | 画面・モック/APIの切替・制約の手動編集と達成判定                                     |
| `apps/backend`  | Hono APIとWorkersによる配信。health・イベント本体API・OpenAPI JSON・Swagger UIを提供 |
| `apps/schema`   | 共有する制約のJSON Schema。実装済み                                                  |
| `apps/solver`   | Pythonの計算処理。現在は生成モデルと疎通確認用のFastAPIのみ                          |

## 処理の流れ

`対話・GUI → backendで検証・条件確認 → solverで計算 → 条件を再評価 → 出演順と達成状況を表示`

- LLM：対応する制約への変換と説明。任意の数式・コードを実行させない。
- backend：入力検証、データ管理、外部呼び出し。秘密情報をブラウザに渡さない。
- solver：固定ロジックで制約をモデル化し、出演順と探索状態を返す。OR-Tools CP-SAT / FastAPIをVercelで動かす。手順・検証結果は[solverのREADME](../apps/solver/README.md)。
- DB：Cloudflare D1は検証用と本番用を分離。Drizzle導入済み。[DB方針](database.md)を参照。

## backendの構造

フォルダー構成と各層の責務は[backendの開発ルール](../apps/backend/AGENTS.md#backendの構造)を参照。

## APIの実装時

health・イベント本体APIにOpenAPI定義・RPC型共有を導入済み。DrizzleとDBの保存処理をイベント本体APIへ接続済み。frontendはAPIモードで既存のイベントAPIへ接続済み。認証・他の業務APIは今後追加する。

- APIは通常のHonoの`app.get()`・`app.post()`で実装し、入力のあるAPIではZodで検証する。OpenAPI仕様は`apps/backend/docs/api/openapi.json`に別途手書きし、API変更時は実装・仕様・対象APIの動作テストを揃える。
- ルート登録の返り値から`AppType`を公開し、frontendのRepositoryで`hc<AppType>()`を使う。backendからは型のみをimportし、サーバーの実装をfrontendへ持ち込まない。
- DrizzleでD1のテーブルを定義し、SQL生成・差分確認・ローカル適用を行う。DBの行型とAPIの入出力は用途に応じて分ける。[DB方針](database.md)を参照。
- OpenAPI 3.1.0を`/api/openapi.json`、Swagger UIを`/api/docs`で提供する。developドメインでUI・JSON・APIを配信し、共有URLから閲覧・試行できる。手書きの仕様JSONをそのまま配信し、APIの動作・応答仕様との整合性はVitestとレビューで確認する。healthにAjvによる契約テストを導入済み。[更新・閲覧手順](../apps/backend/docs/api/README.md)を参照。
- 制約JSONの正本は引き続き`apps/schema`。ZodやOpenAPIに同じ制約を手書きで重複定義せず、実行時検証・OpenAPIとの接続方法は制約APIの実装時に決める。

対応Issueで入力・出力・エラー・必要な権限を具体例とともに決める。生成型だけを信頼せず、IDの存在とイベントへの所属も検証する。探索結果は成功、解なし、探索未完了、内部エラーを区別する。

外部通信・LLMはテストで差し替えられるようにする。LLMはGPT-6 Luna・lowを採用する方針。処理・保存の境界は[AIチャット設計](../apps/backend/docs/AIチャット設計.md)を参照する。認証・公開フォームの詳細、ソルバーの公開先は未確定。将来のためだけの層や汎用化は増やさない。

health・イベント本体APIでOpenAPIの配信・閲覧・RPC型共有を確認する。イベント本体APIはZodで入力を検証し、テスト用D1への保存・再取得をAPIテストとDB結合テストで確認する。認証接続前はRoute内の仮ID定数`demo-owner`をServiceへ渡し、#57で認証済みユーザーIDへ置き換える。frontendは#19で既存APIへ接続する。配置・制約保存はPR #69のマージ後、名簿編集は#16の実装後に追加する。[イベントAPI](../apps/backend/docs/api/events.md)を参照。

参考：[Hono RPCの解説](https://zenn.dev/yusukebe/articles/a00721f8b3b92e#rpcを作る)、[Swagger UI](https://hono.dev/examples/swagger-ui)。

## 現在のフロントエンド

`apps/frontend/src` に配置する。画面とUI部品はモックデータを直接importせず、hooksからRepositoryを利用する。

| 場所                          | 責務                                                   |
| ----------------------------- | ------------------------------------------------------ |
| `app/`                        | ルーティング、デモセッション、ログイン後の復帰先       |
| `features/auth/`              | デモ開始                                               |
| `features/events/`            | イベント一覧・作成・設定・削除                         |
| `features/event/`             | 出演順、制約入力、チャットのデモ、CSV出力              |
| `features/forms/`             | 出演登録とフォーム設定                                 |
| `features/participants/`      | 出演枠・所属メンバーの編集                             |
| `shared/model/`               | イベント・メンバーのモデル、制約の検証・説明・達成判定 |
| `shared/ui/`・`shared/hooks/` | UI部品、取得・入力処理                                 |
| `mock/`                       | 初期データ、メモリ上の共有ストア、Repository実装       |
| `generated/`                  | JSON Schemaから生成した制約型。手編集禁止              |

制約は生成型の `Constraint` をそのまま保持する。入力途中の文字列は `constraintDraft.ts` で扱い、保存時に検証・変換する。表示用の要約・達成状況・固定フラグは現在のデータから導く。

メンバーは名前とIDを分け、出演枠は `memberIds` で所属を持つ。部の表示用IDはドラッグ操作に使い、制約の `part_ids` は部の並びに対応する0始まりの番号とする。このフロント内のモデルはDB・APIの確定済み契約ではない。

モックモードは `画面 → hooks → Repository → メモリ上のストア → 画面`。APIモードはRepositoryから既存イベントAPI・DBへ接続する。自動生成・実認証・LLMは未接続。[デモの操作と制約](frontend.md)を参照。

## frontendのAPI接続（#19）

`VITE_DATA_SOURCE=api` のとき、Repositoryは `shared/api/client.ts` の `hc<AppType>()` を経由し、同一originの `/api` を呼ぶ。`AppType` はbackendから型のみimportする。入力・応答型はHonoから推論し、BE実装はブラウザのbundleへ含めない。型検査前に既存の `npm run cf:typegen` が必要。frontendの型検査にも生成済みWorkers型を参照する。

- 接続済み：イベント一覧・作成・基本情報取得／設定更新・論理削除、出演枠／メンバー／所属／部／配置／制約の取得。
- 設定更新は画面取得時の `updatedAt` を `expectedUpdatedAt` に渡し、409で入力を保持する。保存直前に最新日時を取得して競合を回避しない。
- 出演順画面の複数GETは `updatedAt` が一致した場合だけ表示する。不一致・通信失敗は再取得できるエラーにする。
- 部はAPIの `sortOrder`、配置は `order` に従う。APIにない枠数・空き枠を補完しない。部名・希望原文／状態・制約由来を取得時に保持する。
- 未取得の回答件数は `null` のまま「—」で表示する。フォーム設定・回答取得と名簿取得を分ける。
- モックが既定。APIモードでは認証だけ従来のデモセッションを使い、画面に明示する。業務API失敗時にモックへ戻さない。名簿編集・配置／制約保存・フォーム・chat・Solverは未接続で、未対応操作を成功扱いにしない。

接続先と起動手順は[環境構築](setup.md#frontendをapiモードで起動する19)を参照。
