# 環境構築

## 実行ディレクトリ

この資料のコマンドはすべて**リポジトリルート（`package.json`と`apps/`があるディレクトリ）**で実行する。ローカルのフォルダ名は任意。

別のディレクトリにいる場合は、先に移動する。

```sh
cd /path/to/jphack-2026 # 自分の配置先に置き換える
```

`--directory apps/solver`はuvの実行先をPython側へ切り替える指定。ターミナルで`cd apps/solver`する必要はない。

## 必要なもの

- Git、Node.js・npm、uv。
- Node.jsは`.nvmrc`（現在22.21.1）、Pythonは`apps/solver/.python-version`（現在3.13）に合わせる。
- Wranglerはnpm依存に含まれるため、グローバルインストール不要。

## 初回セットアップ

Node.jsをnvmで管理している場合は、ルートで次を実行して`.nvmrc`に合わせる。他の管理ツールでも可。

```sh
nvm install
nvm use
```

実行場所：リポジトリルート。依存関係とPythonを準備する。

```sh
npm ci
uv python install 3.13
uv sync --locked --directory apps/solver
```

画面・health・イベントAPIのローカル起動にAPIキー・Cloudflareログインは不要。画面は既定でローカルD1を使うため、初回は下記のmigrationとseedを適用する。チャット送信はルートの`.env`または`.dev.vars`のどちらかに`GOOGLE_AI_API_TOKEN`を設定し、migration済みD1と有効なイベントを用意する。ローカルD1はWorkersが手元に作成し、Cloudflare上の検証・本番DBは操作しない。DBの雛形と適用手順は[DB手順](../apps/backend/db/README.md)を参照。Cloudflare上のチャット送信にはdevelop/mainごとに同名のSecretを登録する。秘密情報はGitに含めない。

## Solverの環境変数

計算APIを使う場合は、リポジトリルートで使う環境のファイルを用意する（既存ファイルは上書きしない）。

```sh
cp -n .env.example .env.develop
# 本番への公開時のみ用意する
cp -n .env.example .env.main
```

`SOLVER_API_URL`はSolverのベースURL、`SOLVER_API_TOKEN`はSolverと同じトークン。ローカルSolverではURLを`http://localhost:8000`に変更する。基本画面・イベントAPIの確認だけならトークン不要。`.dev.vars`がある場合は設定をenvファイルへ移す。

ローカル起動では`.env.develop`を読み、各deployコマンドでは対応するenvファイルをWorkersのSecretとして登録する。実ファイルはGit対象外で、`.env.example`だけを共有する。ビルド・checkはenvファイルなしで実行できる。計算APIの詳細は[計算API](../apps/backend/docs/api/solver.md)を参照。

## 起動・確認

実行場所：リポジトリルート。

```sh
npm run db:migrate:local
npm run db:seed:local
npm run dev
```

| URL                                | 用途                                                              |
| ---------------------------------- | ----------------------------------------------------------------- |
| `http://localhost:5173`            | 画面開発。変更を即時反映し、`/api`はWorkersへ転送                 |
| `http://localhost:8787`            | Workersで配信するビルド済み画面。画面変更の反映には再ビルドが必要 |
| `http://localhost:8787/api/health` | API確認。`{"status":"ok"}`が返れば起動成功                        |

`npm run dev`は最初に画面をビルドし、ViteとWorkersを同時起動する。終了は`Ctrl+C`。ポートが使用中なら既存のプロセスを確認する。実際の接続先は起動ログを優先する。

API仕様は[Swagger UI](http://localhost:8787/api/docs)で閲覧・試行できる。developドメインから他のメンバーと共有する方法は[APIドキュメント](../apps/backend/docs/api/README.md)を参照。

Python側は別のターミナルで、同じリポジトリルートから起動する。ローカルで計算する場合は`.env.develop`の`SOLVER_API_URL=http://localhost:8000`と`SOLVER_API_TOKEN`を設定し、次を実行する。BEとSolverが同じファイルからトークンを読む。実計算の`/solve`も提供する。詳細は[solverのREADME](../apps/solver/README.md)を参照。

```sh
npm run dev:solver
```

## 開発開始前のチェック

実行場所：リポジトリルート。

```sh
npm run check
```

整形・lint・生成物一致・型・Vitest・ビルドを確認する。Pythonのテストは含まれない。スキーマの変更手順は[制約と型生成](schema.md)、開発の進め方は[開発ルール](development.md)を参照。

依存関係の更新を取り込んだら`npm ci`と`uv sync --locked --directory apps/solver`を再実行する。生成物の不一致は`npm run codegen`後に差分を確認する。公開は別作業で、通常の環境構築では行わない。

## フロントエンドとブラウザテスト

通常の `npm run dev` はDBのデータを使い、「ワークスペースを開く」から実イベントを作成・表示する。固定データ・モック切替は削除済み。操作については[フロントエンドの使い方](frontend.md)を参照。

```sh
npx playwright install chromium # ブラウザテストを初めて実行する環境のみ
npm run test:e2e
```

ブラウザテストはポート5175でfrontend、8789でWorkersを起動し、専用ローカルD1で保存・再取得を確認する。実LLMは呼ばない。通常の開発画面とは別のfrontendポートを使う。型検査は `npm run check` に含むが、ブラウザテストの実行は別途必要。

## イベントAPIのローカル確認（#15）

管理APIはセッションCookieを検証し、ログインしたユーザーのイベントだけを操作する。クライアントから所有者を指定することはできない。

ローカルDBへmigrationと既存のデモデータを投入する（リモートDBは変更しない）。

```sh
npm run db:migrate:local
npm run db:seed:local
```

seedは既存User `demo-owner`も作るが、ハッシュはログインできないダミー値。下記の管理コマンドで実パスワードを設定するか、画面で新しいIDを登録してから利用する。

```sh
npm run dev
```

`http://localhost:8787/api/docs`のEventsで、一覧・作成・詳細・設定更新・論理削除を試行できる。PATCHにはGET応答の`updatedAt`を`expectedUpdatedAt`として渡す。APIの入出力は[イベントAPI](../apps/backend/docs/api/events.md)を参照。

Swaggerを開く前に同じホストの画面でログインする。Vite経由なら`http://localhost:5173/api/docs`を使う。更新系APIの直接呼び出しにはセッションCookieと接続先と同じ`Origin`が必要。

## frontendをAPIモードで起動する（#19）

既定で実装済みイベントAPIとローカルD1へ接続する。初回はmigration・seedを先に実行する。

```sh
npm run db:migrate:local
npm run db:seed:local
npm run dev
```

`http://localhost:5173` でログイン、または新規登録する。画面はDBに保存されたイベント・名簿を表示する。Viteの `/api` proxyを経由し、Workers配信の画面でも同一originへ接続する。

イベントの一覧・作成・設定変更・論理削除に加え、出演順・部と制約の保存もDBへ反映される。出演順は右上の「保存」で明示保存し、制約は操作後に自動保存される。制約の自動保存では未保存の出演順は保存しない。計算ボタンは出演順→制約→計算の順に呼び、両方の保存が成功した後にD1の内容を設定先のSolverへ送る。保存失敗・競合ではSolverを呼ばない。失敗・競合では自動保存を止めて編集内容を保持し、通知欄の「保存を再試行」または「最新の状態を取得」で復旧できる。未保存編集を破棄する場合は確認が出る。各部の組数は「ライブ情報の編集」から変更し、「適用」後に上部の「保存」で出演順とまとめて保存する。枠数はDBに保存し、空き枠は設定枠数と配置から復元する。空き枠は採番せず、位置指定・制約評価も実際の出演順に合わせる。再取得時も明示的に設定した枠数を維持する。名簿・希望原文・由来は保持する。

チャットは保存済み履歴を復元し、送信・再試行に同じ発言IDを使う。返信の生成には `GOOGLE_AI_API_TOKEN` が必要で、APIキーなしでも既存履歴の閲覧はできる。未保存の出演順は右上から保存し、制約の自動保存完了後に送信する。チャットの変更案は「確認して反映」で一覧へ追加・更新・削除し、同じ制約保存APIで自動保存する。未指定の必須／任意・優先度を画面で選択する。未適用案は画面内だけで保持し、再読込で消える。バンド名・所属の編集は同じイベントIDの実APIへ接続済みの公開フォームを使う。管理画面のバンド本体削除は確認ダイアログ後に管理用DELETEへ接続する。名簿CSVは「出演枠・メンバー」画面から取り込める。フォーム管理は実フォームのURL・名簿件数を表示し、未接続の受付・締切・連絡先設定は表示しない。チャットからの計算実行は後続。Solverは`SOLVER_API_URL`・`SOLVER_API_TOKEN`と実`/solve`の提供が必要で、未設定・外部失敗は画面へエラーを返す。ログインしたユーザーがBEでも所有者として扱われる。

モックデータと切替処理は削除済み。APIエラーは画面に表示し、固定データで代替しない。

ブラウザテスト（専用ローカルD1を自動準備）：

```sh
npm run test:e2e
```

テスト用画面をポート5175で起動する。専用のWorkersを8789で起動し、このworktreeの専用ローカルD1（`.wrangler/e2e-api`）を使う（通常開発の8787は再利用しない）。作成・出演順／制約保存・失敗／再試行・再読込・更新競合・削除、seedの名簿／部名／履歴を実API経由で確認する。チャットの新規生成はHTTP応答を差し替え、外部LLMを呼ばない。seedの配置・制約を変更するテストは終了時に復元し、作成したイベントは論理削除する。`npm run test:e2e:api`は同じテストへの互換コマンド。

## 実Solverを含めたE2E

```sh
npm run test:e2e:solver
```

実際のChromium → Vite（5176）→ Workers（8790）→ FastAPI / CP-SAT（8001）を起動する。migration・seed済みの専用D1と一時トークンを自動作成し、終了時に削除する。通常のローカルD1・`.env.develop`や公開環境の資格情報は使わない。Node・uv・Python・Playwright Chromiumの初回セットアップは先に済ませる。

完全配置と固定・soft未達成、部分配置と未配置対象の未判定、解なし、接続エラー後の再試行、DB再取得・画面再読込後の復元を確認する。成功・部分配置・解なしは実Solverの応答を使用し、接続エラーだけをブラウザで差し替える。探索未完了・保存失敗・競合は既存の単体／API E2Eで別途確認する。

ローカル画面での操作は、`npm run dev:solver`と`npm run dev`をそれぞれ起動して「自動生成」を押す。完全配置・部分配置はBEで検証後に保存し、解なし・探索未完了・通信失敗では直前の配置を保持する。手動編集だけでは計算しない。現状の実Solverは`count`（部ごとの組数）を扱わず、BEはその応答を拒否する（#75）。各部の設定組数は`parts[].bandCount`としてSolverへ渡し、各部の配置上限を固定する。総枠数と登録数が一致すれば各部ちょうどの組数になり、不足時は空き枠、超過時は未配置を残す。共有Constraintの`count`はこれとは別の指定で、引き続き#75の範囲。

## アカウントと既存データの準備（#59）

新規アカウントはログイン画面の「アカウントを作成する」から登録する。IDは3〜64文字の半角英数字・`_`・`-`、パスワードは15〜128文字。メールアドレス・新規の認証用Secretは不要。セッション用のmigrationを先に適用する。

既存`demo-owner`のイベントを維持してログインできるようにする場合は、同じIDのパスワードだけを設定する。以下はローカルD1用で、パスワードは非表示の対話入力を使う。

```sh
npm run db:migrate:local
npm run auth:provision -- --local --user-id demo-owner
```

コマンドは既存データを保持し、パスワード変更時にそのユーザーの全セッションを失効させる。パスワードを引数・Git・共有seedへ書かない。自動実行時は標準入力を使い、コマンドは一時SQLを権限600で作成し、Wranglerの出力を公開せず削除する。ローカルの`demo-owner`だけは`--local-demo-password`で8文字以上のデモ用パスワードを設定できる。通常の新規登録・リモート設定は15文字以上。

公開環境への適用は別操作。対象のmigrationを適用したうえで`auth:provision -- --remote --env develop --user-id demo-owner`（本番は`--env main`）を使う。環境を省略したリモート操作は拒否する。ローカルに設定したパスワードは公開環境へ自動反映されない。

Workersは既存のcompatibility date `2026-10-13`でネイティブscryptを利用する。ハッシュのコストを弱めず、公開時は使用プランのCPU制限と実ログインを確認する。ローカルのWorkers runtimeでは照合まで検証するが、dry-runだけで公開環境のCPU余裕が確認できるわけではない。

ブラウザテストは専用D1へランダムなテスト用認証情報を準備する。一般のseedにはログイン可能な共有パスワード・ハッシュを追加しない。
