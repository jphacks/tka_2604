# バリデーション・チェック・CI

入力の正しさは実行時バリデーション、コードの品質はローカルチェックとCIで確認する。ハッカソンでは主要な入力・制約・デモの動作を優先する。

## 入力バリデーション

| 層                   | 確認すること                                | 現状                                          |
| -------------------- | ------------------------------------------- | --------------------------------------------- |
| JSON Schema          | 必須項目、型、制約タイプ、数値の下限など    | 定義済み。APIでの実行時検証は未実装           |
| TypeScriptの生成型   | 開発時の型の整合性                          | 生成済み。受信したJSONの検証にはならない      |
| Pydanticの生成モデル | Pythonで受け取る構造・値の検証              | 生成済み。APIへの組み込みは未実装             |
| 業務ルール           | hard/priorityの対応、ID・所属、範囲の整合性 | frontend・APIで検証し、DBの整合性もテストする |
| 計算結果             | 欠落・重複、ハード制約、達成状況            | solver実装時に追加                            |

GUIの入力チェックだけに頼らず、backendで外部入力を検証する。LLMの出力も外部入力として扱い、solver側でも受け取ったデータを検証する。生成モデルがJSON Schemaの全条件をそのまま保証するとは扱わない。

最低限、次の入力を拒否する。具体的なエラー形式はAPIを作るIssueで決め、項目と理由が分かる形にする。

- hardなのにpriorityがある、softなのにpriorityがnull。
- 存在しない・別イベントのバンドやメンバーを、新たな所属・配置に指定している。既存制約に対する違反は操作の拒否と分け、[DB方針](database.md)に従って表示する。
- 位置が出演枠の外、範囲の開始が終了より大きい、countのminがmaxより大きい。

解なし・探索未完了・内部エラーは入力不備と区別する。制約の詳細は[制約と型生成](schema.md)を参照。

## ローカルのチェック

ルートで`npm run check`を実行する。以下の順に実行し、失敗した段階で止まる。

| コマンド                | 内容                                                        |
| ----------------------- | ----------------------------------------------------------- |
| `npm run format:check`  | Prettierによる書式確認                                      |
| `npm run lint`          | Workersのbinding型生成とESLint。警告も失敗扱い              |
| `npm run codegen:check` | 一時ディレクトリにTS/Pythonを再生成し、管理中の生成物と比較 |
| `npm run typecheck`     | 各workspaceのTypeScript型検査                               |
| `npm run test`          | frontend・backendのVitest                                   |
| `npm run build`         | frontendビルドとWorkersのdry-run。公開はしない              |

実Geminiを呼ぶAIチャットの回帰評価`npm run eval:chat`は、料金がかかるため`npm run check`・CIに含めず、指示を変えたときに手動で実行する。[AIチャット入出力](../apps/backend/docs/AIチャット入出力.md#実llmの回帰評価)を参照。

ESLintは型を使った検査、React Hooks、アクセシビリティ、import順序・依存関係、frontend/backend間の実装importの禁止を含む。

テストはfrontendがjsdom、backendがNode環境。DBテストはWranglerのgetPlatformProxyで起動するMiniflareのD1を使用する。公開Workers・外部サービスの結合確認とは別。`npm run test:coverage`は任意で、CIには含まれず最低カバレッジの設定もない。Pythonはpytestを導入済み（`uv --directory apps/solver run pytest`）。lintは未導入。

## backendのテスト追加方針

テストは`apps/backend/test/`配下に、実装の`src/`と同じ相対ディレクトリ構成で置く。例：`src/index.ts` → `test/index.test.ts`、`src/db/events.ts` → `test/db/events.test.ts`。共通の初期化・補助処理は`test/helpers/`、テスト用D1の設定は`test/wrangler.jsonc`に置く。

healthの200応答・Content-Type・JSON本文、仕様JSONの配信、RPC型共有と応答の契約テストを導入済み。単体・HTTP API・D1結合・契約テストはVitestのbackend projectとして`npm run test:backend`で実行し、`npm run test`経由で`npm run check`・pre-commit・既存CIにも含む。チェック経路は共通なので、種類ごとのCIジョブは追加しない。RPC型は`npm run typecheck`で確認する。

| 対象                     | 確認する振る舞い                                                                                                    |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| 業務ロジックの単体テスト | ID・所属・範囲の判定など、処理の正常系・境界値・異常系                                                              |
| APIのリクエストテスト    | `app.request()`または`hono/testing`で入力検証、ステータス、応答内容。不正入力・権限エラー時に保存されないこと       |
| D1との結合テスト         | テスト用D1に実際のマイグレーションを適用し、Drizzleによる保存・再取得・DB制約を確認する。テスト間のデータを分離する |
| API仕様との契約確認      | 手書きOpenAPIの応答スキーマと実レスポンスのステータス・Content-Type・JSON本文を照合する。RPCの型検査も行う          |
| FE・BEのE2E              | 画面から業務API・ローカルD1へ接続し、登録→保存→再読込などを確認。`npm run test:e2e:api`で実行                       |

契約テストの最小例は`test/openapi.test.ts`。healthの実レスポンスをAjvで検証し、項目欠落・型・enum・ステータス・Content-Typeの不一致を検出する。[API手順](../apps/backend/docs/api/README.md)を参照。APIと手書き仕様は同じ変更で更新し、入力・エラー・権限などはAPIの動作テストで確認する。仕様のレビューとSwagger UIでの確認も続ける。

D1は#14で導入した`test/helpers/database.ts`を再利用する。各テストに隔離したD1へ実migrationを適用し、終了時に破棄する。[保存・再取得の最小例](../apps/backend/db/README.md#db結合テスト)を参照。部分更新防止・別イベント参照・配置重複・更新競合は`test/db/database.test.ts`と`test/db/save-event.test.ts`に既存例がある。各機能Issueでも該当するケースを追加し、不正入力や失敗でデータが変わらないことをAPI経由でも確認する。D1のモックだけでDB処理を確認済みにしない。

### LLM・Solver通信の差し替え

通信実装時は外部クライアントへ`fetch`相当の関数を渡せるようにし、通常テストでは`vi.fn<typeof fetch>()`に差し替える。以下はテストファイル内に置ける最小例。`readResult`は差し替え方の例示用で、業務APIや実サービスの契約を定義するものではない。

```ts
import { expect, it, vi } from 'vitest'

async function readResult(send: typeof fetch) {
  const response = await send('https://service.invalid/result')
  if (!response.ok) throw new Error('upstream_failed')
  return response.json() as Promise<unknown>
}

it('外部通信の成功・HTTPエラー・通信失敗を差し替える', async () => {
  const send = vi.fn<typeof fetch>()
  send.mockResolvedValueOnce(Response.json({ result: 'example' }))
  await expect(readResult(send)).resolves.toEqual({ result: 'example' })
  send.mockResolvedValueOnce(new Response(null, { status: 503 }))
  await expect(readResult(send)).rejects.toThrow('upstream_failed')
  send.mockRejectedValueOnce(new Error('network_failure'))
  await expect(readResult(send)).rejects.toThrow('network_failure')
})
```

各機能ではこの差し替えをAPIのテストへ渡し、外部通信失敗時の応答や保存されないことを確認する。タイムアウト・不正な応答も、その通信仕様に応じて追加する。未実装の通信機能をこの基盤のためだけに追加しない。

### 別実行・後続Issueでの確認

- 実LLM／Solver通信は、接続先・起動手順を対応Issueで定めて別実行する。FE・BEのE2EはローカルD1と外部通信の差し替えでCIでも確認する。check・pre-commit・CIは外部サービスや資格情報に依存させない。
- 個別機能のテストは各実装Issue、認証・権限のテストは認証導入時に追加する。DB内部関数の所有者確認だけで、HTTPの認証を確認済みにしない。
- Pythonテストは#21、計算APIテストは#27の担当範囲を維持する。`npm run check`にはPythonテストを含めず、CIのQuality checks内で `uv run --locked pytest` を別途実行する。

## フロントエンドのブラウザテスト

`npm run test:e2e` でPlaywright / Chromiumを実行する。初回は `npx playwright install chromium` が必要。設定は `apps/frontend/playwright.config.ts`、テストは `apps/frontend/e2e/` に置く。

ワークスペースへの入口・登録・設定・画面間の共有、番号入力・ドラッグ・キーボード操作、6種類の制約入力と達成判定、同名メンバーの区別、モバイル幅を確認する。各テストは別のブラウザコンテキストで実行し、ブラウザの未処理エラーも失敗にする。

ポート5175でVite、8789でWorkersを起動し、既存サーバーを再利用しない。結果・スクリーンショット・失敗時のtraceは `apps/frontend/test-results/` に出力し、Gitには含めない。CIでは1 workerで実行し、HTMLレポートも生成する。`test.only`が含まれると失敗させる。

E2Eの型検査は `npm run typecheck` に含む。ブラウザテストの実行は `npm run check`・pre-commitには含めず、画面変更時に別途実行する。CIでは以下の独立ジョブで実行する。

- `npm run test:e2e`：実装済みAPIとローカルD1を通す。事前にfrontendビルド・ローカルmigration・seedを実行する。専用Workersの8789と画面の5175を使い、通常開発のサーバーは再利用しない。新規LLM生成・Solver応答は差し替え、公開サービスは呼ばない。

`npm run test:e2e:api`も同じテストへの互換コマンド。専用D1は`.wrangler/e2e-api`に自動準備し、通常開発のDBとは分離する。ローカル準備は[環境構築](setup.md#frontendをapiモードで起動する19)を参照。

## commit時

`npm ci`でHuskyを準備し、pre-commitで次を実行する。

1. `npm run lint:staged`：binding型生成、stageした対象のESLint・Prettier確認。
2. `npm run codegen:check`。
3. `npm run typecheck`。
4. `npm run test`。

生成物の比較・型検査・テストはstageしたファイルだけに限定されない。pre-pushは未設定で、ビルドはpre-commitに含まれないため、PR前は`npm run check`も実行する。命名規則の自動チェックは現在なく、レビューで確認する。

## GitHub Actions

正本は[ci.yml](../.github/workflows/ci.yml)。pushとpull_requestを契機に、UbuntuでNode・uv・Pythonを準備し、`npm ci` → `npm run check` → Python Solverの `uv run --locked pytest` を実行する。

- `Quality checks`（上限10分）と`E2E (api)`（上限15分）を並列実行する。同じイベント・refの古い実行は中止する。
- CIではHuskyを無効化する。E2EジョブはNode・npm依存・ChromiumとOS依存を準備する。API版はジョブ内のローカルD1を初期化し、リモートDBやSecretは使わない。
- E2Eの失敗はジョブの失敗とする。終了時は成功・失敗ともHTMLレポートとテスト結果を`playwright-api` artifactへ保存する（保持7日、キャンセル時は保存しない）。失敗した操作はスクリーンショット・traceで確認できる。
- デプロイ・本番DB変更は行わない。
- CI成功の必須化はGitHub側のブランチ保護設定が必要。このworkflowだけではマージを制限しない。リモートの設定状態は未確認。

失敗時はログの最初の失敗段階を確認し、関連箇所を直して再実行する。整形は変更ファイルだけに適用し、生成物不一致は`npm run codegen`後に差分を確認する。未確認・失敗・CI待ちは成功と分けてPRに記載する。
