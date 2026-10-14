# バリデーション・チェック・CI

入力の正しさは実行時バリデーション、コードの品質はローカルチェックとCIで確認する。ハッカソンでは主要な入力・制約・デモの動作を優先する。

## 入力バリデーション

| 層                   | 確認すること                                | 現状                                     |
| -------------------- | ------------------------------------------- | ---------------------------------------- |
| JSON Schema          | 必須項目、型、制約タイプ、数値の下限など    | 定義済み。APIでの実行時検証は未実装      |
| TypeScriptの生成型   | 開発時の型の整合性                          | 生成済み。受信したJSONの検証にはならない |
| Pydanticの生成モデル | Pythonで受け取る構造・値の検証              | 生成済み。APIへの組み込みは未実装        |
| 業務ルール           | hard/priorityの対応、ID・所属、範囲の整合性 | 未実装。対応機能と一緒に追加             |
| 計算結果             | 欠落・重複、ハード制約、達成状況            | solver実装時に追加                       |

GUIの入力チェックだけに頼らず、backendで外部入力を検証する。LLMの出力も外部入力として扱い、solver側でも受け取ったデータを検証する。生成モデルがJSON Schemaの全条件をそのまま保証するとは扱わない。

最低限、次の入力を拒否する。具体的なエラー形式はAPIを作るIssueで決め、項目と理由が分かる形にする。

- hardなのにpriorityがある、softなのにpriorityがnull。
- 存在しない・別イベントのバンドやメンバーを参照している。
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

ESLintは型を使った検査、React Hooks、アクセシビリティ、import順序・依存関係、frontend/backend間の実装importの禁止を含む。

テストはfrontendがjsdom、backendがNode環境。実ブラウザ・実Workers・外部サービスの結合確認とは別。`npm run test:coverage`は任意で、CIには含まれず最低カバレッジの設定もない。Pythonのテスト・lintは未導入。

## commit時

`npm ci`でHuskyを準備し、pre-commitで次を実行する。

1. `npm run lint:staged`：binding型生成、stageした対象のESLint・Prettier確認。
2. `npm run codegen:check`。
3. `npm run typecheck`。
4. `npm run test`。

生成物の比較・型検査・テストはstageしたファイルだけに限定されない。pre-pushは未設定で、ビルドはpre-commitに含まれないため、PR前は`npm run check`も実行する。命名規則の自動チェックは現在なく、レビューで確認する。

## GitHub Actions

正本は[ci.yml](../.github/workflows/ci.yml)。pushとpull_requestを契機に、UbuntuでNode・uv・Pythonを準備し、`npm ci` → `npm run check`を実行する。

- ジョブ名は`Quality checks`、上限10分。同じイベント・refの古い実行は中止する。
- CIではHuskyを無効化し、上記チェックを直接実行する。
- デプロイ・本番DB変更は行わない。
- CI成功の必須化はGitHub側のブランチ保護設定が必要。このworkflowだけではマージを制限しない。リモートの設定状態は未確認。

失敗時はログの最初の失敗段階を確認し、関連箇所を直して再実行する。整形は変更ファイルだけに適用し、生成物不一致は`npm run codegen`後に差分を確認する。未確認・失敗・CI待ちは成功と分けてPRに記載する。
