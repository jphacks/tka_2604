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

現在のローカル起動にAPIキー・Cloudflareログインは不要。ローカルD1はWorkersが手元に作成し、Cloudflare上の検証・本番DBは操作しない。DBの雛形と適用手順は[DB手順](../apps/backend/db/README.md)を参照。LLM導入時に必要な環境変数を追記する。秘密情報はGitに含めない。

## 起動・確認

実行場所：リポジトリルート。

```sh
npm run dev
```

| URL                                | 用途                                                              |
| ---------------------------------- | ----------------------------------------------------------------- |
| `http://localhost:5173`            | 画面開発。変更を即時反映し、`/api`はWorkersへ転送                 |
| `http://localhost:8787`            | Workersで配信するビルド済み画面。画面変更の反映には再ビルドが必要 |
| `http://localhost:8787/api/health` | API確認。`{"status":"ok"}`が返れば起動成功                        |

`npm run dev`は最初に画面をビルドし、ViteとWorkersを同時起動する。終了は`Ctrl+C`。ポートが使用中なら既存のプロセスを確認する。実際の接続先は起動ログを優先する。

Python側は別のターミナルで、同じリポジトリルートから起動する。現在はHTTPサーバーではなく、挨拶を出力する入口のみ。

```sh
uv --directory apps/solver run python src/main.py
```

## 開発開始前のチェック

実行場所：リポジトリルート。

```sh
npm run check
```

整形・lint・生成物一致・型・Vitest・ビルドを確認する。Pythonのテストは含まれない。スキーマの変更手順は[制約と型生成](schema.md)、開発の進め方は[開発ルール](development.md)を参照。

依存関係の更新を取り込んだら`npm ci`と`uv sync --locked --directory apps/solver`を再実行する。生成物の不一致は`npm run codegen`後に差分を確認する。公開は別作業で、通常の環境構築では行わない。
