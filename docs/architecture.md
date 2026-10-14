# 構成・技術選定

## 技術選定

| 用途                   | 技術                                                               | 状態・理由                                                 |
| ---------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------- |
| フロントエンド         | React / TypeScript / Vite / Tailwind CSS                           | 導入済み。画面を素早く実装する                             |
| API・配信              | Hono / Cloudflare Workers                                          | 導入済み。TypeScriptでAPIと画面配信をまとめる              |
| 制約の共有             | JSON Schema / json-schema-to-typescript / datamodel-code-generator | 導入済み。TypeScriptとPythonのモデルを同じ定義から生成する |
| Python環境・入力モデル | uv / Pydantic                                                      | 導入済み。依存管理と構造化データの検証                     |
| 最適化API              | FastAPI / OR-Tools CP-SAT                                          | 採用予定。順序・間隔の制約をPythonで扱う                   |
| 保存                   | Cloudflare D1 / Drizzle                                            | D1 binding導入済み。Drizzleと業務テーブルは未導入          |
| テスト                 | Vitest / Testing Library                                           | 導入済み。frontend・backendの振る舞いを確認する            |
| LLM・ソルバー公開先    | 未確定                                                             | 対応Issueで決める                                          |

## 配置

| 場所            | 責務・状態                                               |
| --------------- | -------------------------------------------------------- |
| `apps/frontend` | Reactの画面。現在はひな形                                |
| `apps/backend`  | Hono APIとWorkersによる配信。現在は`GET /api/health`のみ |
| `apps/schema`   | 共有する制約のJSON Schema。実装済み                      |
| `apps/solver`   | Pythonの計算処理。現在は生成モデルと起動入口のみ         |

## 処理の流れ

`対話・GUI → backendで検証・条件確認 → solverで計算 → 条件を再評価 → 出演順と達成状況を表示`

- LLM：対応する制約への変換と説明。任意の数式・コードを実行させない。
- backend：入力検証、データ管理、外部呼び出し。秘密情報をブラウザに渡さない。
- solver：固定ロジックで制約をモデル化し、出演順と探索状態を返す。OR-Tools CP-SAT / FastAPIを採用予定。
- DB：Cloudflare D1は検証用と本番用を分離。Drizzleは導入予定。[DB方針](database.md)を参照。

## APIの実装時

対応Issueで入力・出力・エラー・必要な権限を具体例とともに決める。生成型だけを信頼せず、IDの存在とイベントへの所属も検証する。探索結果は成功、解なし、探索未完了、内部エラーを区別する。

外部通信・LLMはテストで差し替えられるようにする。認証・公開フォームの詳細、LLMモデル、ソルバーの公開先は未確定。将来のためだけの層や汎用化は増やさない。
