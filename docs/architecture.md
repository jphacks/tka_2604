# 構成・技術選定

## 技術選定

| 用途                   | 技術                                                               | 状態・理由                                                    |
| ---------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------- |
| フロントエンド         | React / TypeScript / Vite / Tailwind CSS / React Router / dnd-kit  | 導入済み。画面を素早く実装する                                |
| API・配信              | Hono / Cloudflare Workers                                          | 導入済み。TypeScriptでAPIと画面配信をまとめる                 |
| API入力検証・仕様      | Zod / OpenAPI                                                      | イベント・チャット入力にZod導入済み。OpenAPIは別JSONで管理    |
| FE・BEの型共有         | Hono RPC                                                           | health・イベントAPIの型共有、チャットのfrontend接続を実装済み |
| APIドキュメント閲覧    | Swagger UI                                                         | 導入済み。developドメインで仕様を共有・APIを試行する          |
| 制約の共有             | JSON Schema / json-schema-to-typescript / datamodel-code-generator | 導入済み。TypeScriptとPythonのモデルを同じ定義から生成する    |
| Python環境・入力モデル | uv / Pydantic                                                      | 導入済み。依存管理と構造化データの検証                        |
| 最適化API              | FastAPI / OR-Tools CP-SAT / Vercel                                 | 疎通確認済み（#26）。順序・間隔の制約をPythonで扱う           |
| 保存                   | Cloudflare D1 / Drizzle                                            | 導入済み。イベント本体APIから保存・再取得を接続済み           |
| テスト                 | Vitest / Testing Library / Playwright                              | 導入済み。frontend・backendの振る舞いを確認する               |
| LLM                    | Google AI Studio / Gemini 3.5 Flash-Lite                           | チャット送信APIからのLLM呼び出し・会話本文保存を実装済み      |
| ソルバー公開先         | 未確定                                                             | 対応Issueで決める                                             |

## 配置

| 場所            | 責務・状態                                                                                     |
| --------------- | ---------------------------------------------------------------------------------------------- |
| `apps/frontend` | 画面・実APIへの接続・制約の手動編集と達成判定                                                  |
| `apps/backend`  | Hono APIとWorkersによる配信。health・イベントAPI・チャット送信・OpenAPI JSON・Swagger UIを提供 |
| `apps/schema`   | 共有する制約のJSON Schema。実装済み                                                            |
| `apps/solver`   | Pythonの計算処理。現在は生成モデルと疎通確認用のFastAPIのみ                                    |

## 処理の流れ

`対話・GUI → backendで検証・条件確認 → solverで計算 → 条件を再評価 → 出演順と達成状況を表示`

- LLM：対応する制約への変換と説明。任意の数式・コードを実行させない。
- backend：入力検証、データ管理、外部呼び出し。秘密情報をブラウザに渡さない。
- solver：固定ロジックで制約をモデル化し、出演順と探索状態を返す。OR-Tools CP-SAT / FastAPIをVercelで動かす。手順・検証結果は[solverのREADME](../apps/solver/README.md)。
- DB：Cloudflare D1は検証用と本番用を分離。Drizzle導入済み。[DB方針](database.md)を参照。

## backendの構造

フォルダー構成と各層の責務は[backendの開発ルール](../apps/backend/AGENTS.md#backendの構造)を参照。

## APIの実装時

health・イベント本体と情報取得・チャット送信APIにOpenAPI定義・RPC型共有を導入済み。DrizzleとDBの保存・取得処理をイベントAPIへ接続済み。チャット送信はfrontendから接続済み。イベント取得・設定更新・出演順／制約の保存・チャット送信と履歴復元をfrontendへ接続済み。認証・承認後の制約適用は今後追加する。

- APIは通常のHonoの`app.get()`・`app.post()`で実装し、入力のあるAPIではZodで検証する。OpenAPI仕様は`apps/backend/docs/api/openapi.json`に別途手書きし、API変更時は実装・仕様・対象APIの動作テストを揃える。
- ルート登録の返り値から`AppType`を公開し、frontendのRepositoryで`hc<AppType>()`を使う。チャットはbindingに依存しないルート単位の`ChatAppType`を使う。backendからは型のみをimportし、サーバーの実装をfrontendへ持ち込まない。
- DrizzleでD1のテーブルを定義し、SQL生成・差分確認・ローカル適用を行う。DBの行型とAPIの入出力は用途に応じて分ける。[DB方針](database.md)を参照。
- OpenAPI 3.1.0を`/api/openapi.json`、Swagger UIを`/api/docs`で提供する。developドメインでUI・JSON・APIを配信し、共有URLから閲覧・試行できる。手書きの仕様JSONをそのまま配信し、APIの動作・応答仕様との整合性はVitestとレビューで確認する。healthにAjvによる契約テストを導入済み。[更新・閲覧手順](../apps/backend/docs/api/README.md)を参照。
- 制約JSONの正本は引き続き`apps/schema`。実行時検証は`shared/constraints/schema.ts`で正本の参照を解決してZodへ渡し、イベントとチャットで共用する。OpenAPIのConstraint定義も正本と照合し、同じ制約を手書きで重複定義しない。

対応Issueで入力・出力・エラー・必要な権限を具体例とともに決める。生成型だけを信頼せず、IDの存在とイベントへの所属も検証する。探索結果は成功、解なし、探索未完了、内部エラーを区別する。

外部通信・LLMはテストで差し替えられるようにする。LLMはGoogle AI StudioのGemini 3.5 Flash-Lite（`gemini-3.5-flash-lite`）を使用する。Google GenAI SDKによる外部通信は`integrations/llm`、入力の組み立て・履歴の選択・変更案の検証は`services/chat`へ置く。イベント関連のDTO・取得Repository・`EventError`・共有Schema＋Zodの制約検証は、マージ済みPR #60の共通実装を使う。処理・保存の境界は[AIチャット設計](../apps/backend/docs/AIチャット設計.md)を参照する。認証・公開フォームの詳細、ソルバーの公開先は未確定。将来のためだけの層や汎用化は増やさない。

health・イベント本体APIでOpenAPIの配信・閲覧・RPC型共有を確認する。イベント本体APIはZodで入力を検証し、テスト用D1への保存・再取得をAPIテストとDB結合テストで確認する。認証接続前はRoute内の仮ID定数`demo-owner`をServiceへ渡し、#57で認証済みユーザーIDへ置き換える。frontendは#19で既存APIへ接続する。[イベントAPI](../apps/backend/docs/api/events.md)を参照。

参考：[Hono RPCの解説](https://zenn.dev/yusukebe/articles/a00721f8b3b92e#rpcを作る)、[Swagger UI](https://hono.dev/examples/swagger-ui)。

## 現在のフロントエンド

`apps/frontend/src` に配置する。画面とUI部品はモックデータを直接importせず、hooksからRepositoryを利用する。

| 場所                          | 責務                                                   |
| ----------------------------- | ------------------------------------------------------ |
| `app/`                        | ルーティング、ワークスペースへの入口、復帰先           |
| `features/auth/`              | ワークスペースへの入口                                 |
| `features/events/`            | イベント一覧・作成・設定・削除                         |
| `features/event/`             | 出演順、制約入力、チャット送受信、CSV出力              |
| `features/forms/`             | 出演登録とフォーム設定                                 |
| `features/participants/`      | 出演枠・所属メンバーの編集                             |
| `shared/model/`               | イベント・メンバーのモデル、制約の検証・説明・達成判定 |
| `shared/ui/`・`shared/hooks/` | UI部品、取得・入力処理                                 |
| `mock/`                       | 初期データ、メモリ上の共有ストア、Repository実装       |
| `generated/`                  | JSON Schemaから生成した制約型。手編集禁止              |

制約は生成型の `Constraint` をそのまま保持する。入力途中の文字列は `constraintDraft.ts` で扱い、保存時に検証・変換する。表示用の要約・達成状況・固定フラグは現在のデータから導く。

メンバーは名前とIDを分け、出演枠は `memberIds` で所属を持つ。部の表示用IDはドラッグ操作に使い、制約の `part_ids` は部の並びに対応する0始まりの番号とする。このフロント内のモデルはDB・APIの確定済み契約ではない。

APIモードは `画面 → hooks → Repository → backend → D1 → 画面`。イベント・配置・制約・会話本文を保存・復元する。モックモードの業務データはメモリ上のストアを使う。実認証・管理専用名簿編集のAPI接続は後続。公開フォームの名簿登録・更新と管理画面の名簿取得は接続済み。計算ボタンは保存済みデータからのSolver APIへ接続するが、Pythonの実`/solve`は#27の担当。[画面の操作と制約](frontend.md)を参照。

## frontendのAPI接続（#19）

既定のAPIモードでは、Repositoryは `shared/api/client.ts` の `hc<AppType>()` を経由し、同一originの `/api` を呼ぶ。`AppType` はbackendから型のみimportする。入力・応答型はHonoから推論し、BE実装はブラウザのbundleへ含めない。型検査前に既存の `npm run cf:typegen` が必要。frontendの型検査にも生成済みWorkers型を参照する。

- 接続済み：イベント一覧・作成・基本情報取得／設定更新・論理削除、出演枠／メンバー／所属／部／配置／制約の取得、出演順・制約の保存、チャット送信・履歴復元。
- 設定更新は画面取得時の `updatedAt` を `expectedUpdatedAt` に渡し、409で入力を保持する。保存直前に最新日時を取得して競合を回避しない。
- 出演順画面の複数GETは `updatedAt` が一致した場合だけ表示する。不一致・通信失敗は再取得できるエラーにする。
- 部はAPIの `sortOrder`、配置は `order` に従う。表示には各部4枠以上の空き枠を補い、枠数は画面内だけで保持する。部名・希望原文／状態・制約由来を取得時に保持する。
- 画面構成・通常時の操作部は `feature/47` のモックUIを基準にする。API説明帯は追加しない。出演順の右上だけに保存ボタンを置き、番号入力・ドラッグ・部数変更は押下時に保存する。制約は手動／チャットの追加・編集・削除・固定変更を同じ配列へ反映して自動保存し、出演順の未保存編集を巻き込まない。保存は取得時の更新日時を使い、成功応答の日時を次の保存へ引き継ぐ。計算ボタンでは出演順→制約の保存が成功してから最新の更新日時で `/solve` を呼ぶ。backendはD1の保存済み情報からVercelへのリクエストを組み立てる。途中の失敗・競合では計算しない。2本の保存を一括成功扱いにしない。通信失敗・競合では自動保存を停止して編集内容を保持し、既存の通知欄で再試行・再取得を選べる。再取得による破棄は確認する。
- APIモードも元の組数入力・空き枠・ドラッグ操作を使う。空き枠は画面内だけの表示で、番号と制約評価は空き枠を除いた実際の出演順に合わせる。保存時は空き枠を除いて部内順を連続させ、表示上の枠数は変えない。再取得時の枠数は各部4以上かつ配置数以上に戻る。枠数だけの変更は未保存の業務変更として数えない。制約の位置指定の上限は未配置を含む登録バンド数。
- チャットの保存済み発言IDと回答元IDを保持し、再読込・イベント切替後も対象イベントの履歴を復元する。送信失敗は同じ発言IDで再試行でき、返信後は保存済み履歴を再取得する。送信中は重複送信を抑止し、APIモードの未保存配置は右上から保存し、自動保存中の制約は完了してから送信する。新規応答の制約変更案は確認用に表示し、未指定の必須／任意・優先度を選択してから反映・自動保存する。未適用案は画面内のみで保持し、再読込や同じ発言の再送では復元しない。チャットの計算意図判定は後続で、計算は実行ボタンから行う。
- 未取得の回答件数は `null` のまま「—」で表示する。フォーム設定・回答取得と名簿取得を分ける。
- APIモードが既定。`MODE=test`かつ`VITE_DATA_SOURCE=mock`のテスト実行時だけ固定データを使う。通常開発・productionビルドは古いmockフラグが残っていても実APIを使う。認証APIの接続は別Issueで扱い、開始ボタンは共有ワークスペースへの入口とする。業務API失敗時にモックへ戻さない。名簿の追加・所属編集は実APIの公開フォームへ進む。管理専用の削除・CSV取込はAPI実装まで表示しない。フォーム管理は回答URLと実名簿を表示し、保存先のない設定を編集可能にしない。

接続先と起動手順は[環境構築](setup.md#frontendをapiモードで起動する19)を参照。
