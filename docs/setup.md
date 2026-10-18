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

## フロントエンドのデモとブラウザテスト

モックのデモは `VITE_DATA_SOURCE=mock npm run dev` で起動した画面から「デモアカウントで試す」を選ぶ。通常の `npm run dev` はDBのデータを使う。追加の認証情報は不要。操作とデータのリセットについては[フロントエンドのデモ](frontend.md)を参照。

```sh
npx playwright install chromium # ブラウザテストを初めて実行する環境のみ
npm run test:e2e
```

ブラウザテストはポート5174でfrontendを起動し、チャットAPI契約に合わせたモック応答の表示も確認する。実LLMは呼ばない。通常の開発画面とは別のfrontendポートを使う。型検査は `npm run check` に含むが、ブラウザテストの実行は別途必要。

## イベントAPIのローカル確認（#15）

認証は後工程で追加する。現在のイベントAPIはRoute内の仮ID定数`demo-owner`のイベントに限定する。環境変数の設定は不要で、クライアントから所有者を指定することはできない。

ローカルDBへmigrationと既存のデモデータを投入する（リモートDBは変更しない）。

```sh
npm run db:migrate:local
npm run db:seed:local
```

seedは仮ID定数に対応する既存User `demo-owner`も作る。投入後、そのまま起動する。

```sh
npm run dev
```

`http://localhost:8787/api/docs`のEventsで、一覧・作成・詳細・設定更新・論理削除を試行できる。PATCHにはGET応答の`updatedAt`を`expectedUpdatedAt`として渡す。APIの入出力は[イベントAPI](../apps/backend/docs/api/events.md)を参照。

認証接続時は#57で仮ID定数を認証済みユーザーIDへ置き換える。Userの自動作成・認証の実装・リモートへの設定やデプロイはこの手順に含めない。

## frontendをAPIモードで起動する（#19）

既定で実装済みイベントAPIとローカルD1へ接続する。初回はmigration・seedを先に実行する。

```sh
npm run db:migrate:local
npm run db:seed:local
npm run dev
```

`http://localhost:5173` で「デモアカウントで試す」を選ぶ。画面構成はモックUIと共通で、API接続の説明帯は表示しない。Viteの `/api` proxyを経由し、Workers配信の画面でも同一originへ接続する。Vite環境変数はビルド時に固定されるため、既存サーバーは停止してから切り替える。

イベントの一覧・作成・設定変更・論理削除に加え、出演順・部と制約の保存もDBへ反映される。出演順は右上の「保存」で明示保存し、制約は操作後に自動保存される。制約の自動保存では未保存の出演順は保存しない。計算ボタンは出演順→制約→計算の順に呼び、両方の保存が成功した後にD1の内容を設定先のSolverへ送る。保存失敗・競合ではSolverを呼ばない。失敗・競合では自動保存を止めて編集内容を保持し、通知欄の「保存を再試行」または「最新の状態を取得」で復旧できる。未保存編集を破棄する場合は確認が出る。元の画面と同じ各部の組数入力・空き枠・ドラッグを使える。空き枠と枠数は画面内だけで保持し、APIには実際の出演順だけを保存する。空き枠は採番せず、位置指定・制約評価も実際の出演順に合わせる。再取得時の枠数は各部4以上かつ配置数以上に戻る。名簿・希望原文・由来は保持する。

チャットは保存済み履歴を復元し、送信・再試行に同じ発言IDを使う。返信の生成には `GOOGLE_AI_API_TOKEN` が必要で、APIキーなしでも既存履歴の閲覧はできる。未保存の出演順は右上から保存し、制約の自動保存完了後に送信する。チャットの変更案は「確認して反映」で一覧へ追加・更新・削除し、同じ制約保存APIで自動保存する。未指定の必須／任意・優先度を画面で選択する。未適用案は画面内だけで保持し、再読込で消える。名簿編集・CSV取込は#16のAPI実装後に接続する。フォーム接続とチャットからの計算実行は後続。Solverは`SOLVER_API_URL`・`SOLVER_API_TOKEN`と実`/solve`の提供が必要で、未設定・外部失敗は画面へエラーを返す。ログインは実認証ではなく、BEの所有者は従来どおり `demo-owner`。

モックを使う場合は `VITE_DATA_SOURCE=mock npm run dev`。APIエラーで自動的にモックへ切り替わることはない。

APIモードのブラウザテスト（ローカルD1の準備後）：

```sh
npm run test:e2e:api --workspace=@jphack-2026/frontend
```

APIモード専用の画面をポート5175で起動する。専用のWorkersを8789で起動し、このworktreeのローカルD1を使う（通常開発の8787は再利用しない）。作成・出演順／制約保存・失敗／再試行・再読込・更新競合・削除、seedの名簿／部名／履歴を実API経由で確認する。チャットの新規生成はHTTP応答を差し替え、外部LLMを呼ばない。seedの配置・制約を変更するテストは終了時に復元し、作成したイベントは論理削除する。既存モックのブラウザテスト `npm run test:e2e` は引き続き5174を使う。

## 実Solverを含めたE2E

```sh
npm run test:e2e:solver
```

実際のChromium → Vite（5176）→ Workers（8790）→ FastAPI / CP-SAT（8001）を起動する。migration・seed済みの専用D1と一時トークンを自動作成し、終了時に削除する。通常のローカルD1・`.env.develop`や公開環境の資格情報は使わない。Node・uv・Python・Playwright Chromiumの初回セットアップは先に済ませる。

完全配置と固定・soft未達成、部分配置と未配置対象の未判定、解なし、接続エラー後の再試行、DB再取得・画面再読込後の復元を確認する。成功・部分配置・解なしは実Solverの応答を使用し、接続エラーだけをブラウザで差し替える。探索未完了・保存失敗・競合は既存の単体／API E2Eで別途確認する。

ローカル画面での操作は、`npm run dev:solver`と`npm run dev`をそれぞれ起動して「自動生成」を押す。完全配置・部分配置はBEで検証後に保存し、解なし・探索未完了・通信失敗では直前の配置を保持する。手動編集だけでは計算しない。現状の実Solverは`count`（部ごとの組数）を扱わず、BEはその応答を拒否する（#75）。画面の各部の組数は空き枠数であり、Solverの組数制約ではない。
