# Python ソルバー

Python 3.13・uv で管理するプロジェクトです。FastAPI のアプリ（`src/main.py`）と、JSON Schema から生成した Pydantic v2 の制約モデルがあります。現在の API は実行先の疎通確認用で、出演順の計算 API は #20・#27 で用意します。

## 構成

```text
apps/solver/
  .python-version       # Python 3.13
  .vercelignore         # Vercel に送らないファイル
  pyproject.toml        # 依存関係・pytest・コード生成の設定
  uv.lock               # 依存関係のロックファイル
  src/
    main.py             # FastAPI アプリ（Vercel の入口）
    generated/
      constraint.py     # 生成された制約モデル（手編集禁止）
  bench/                # 計測用の仮名データ・判定・計測スクリプト（bench/README.md）
  tests/
    test_main.py        # API のテスト
    test_bench.py       # 計測用データと判定のテスト
    test_csv_to_request.py  # 名簿CSVの変換のテスト
```

依存パッケージは FastAPI・OR-Tools・Pydantic、開発用パッケージは datamodel-code-generator・pytest・httpx・uvicorn です。プロジェクト自体のパッケージ化は行いません。

## API

| メソッド・パス | 認証                                       | 内容                                                                                                         |
| -------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| `GET /health`  | なし                                       | `{"status":"ok"}` を返す                                                                                     |
| `POST /probe`  | `Authorization: Bearer <SOLVER_API_TOKEN>` | 3バンドを「AはCより前」で並べる固定モデルを CP-SAT で解き、状態・順番・計算時間・OR-Tools のバージョンを返す |

`/probe` はトークンが違えば 401、サーバーに `SOLVER_API_TOKEN` が未設定なら 503 を返します（未設定のまま公開されないようにするため）。

## セットアップ・起動

uv をインストールした環境で、リポジトリルートから実行します。

```sh
uv sync --locked --directory apps/solver
SOLVER_API_TOKEN=local uv --directory apps/solver run uvicorn main:app --app-dir src --port 8000
```

```sh
curl http://localhost:8000/health
curl -X POST http://localhost:8000/probe -H 'Authorization: Bearer local'
```

## テスト

```sh
uv --directory apps/solver run pytest
```

`npm run check` と CI には Python のテストはまだ含まれません。

## Vercel へのデプロイ

`apps/solver` を1つの Vercel プロジェクトとしてデプロイします。Vercel は `src/main.py` の `app` を FastAPI の入口として検出し、`pyproject.toml`・`uv.lock` から依存関係を入れます。

```sh
cd apps/solver
vercel link                                 # 初回のみ。.vercel/ はコミットしない
vercel env add SOLVER_API_TOKEN production  # 推測されにくい値を設定する
vercel deploy --prod
```

- トークンの値は Git・ログ・チャットに残さない。Workers 側には `wrangler secret put` で同じ値を設定する（接続は #27・#28）。
- プレビューデプロイは Vercel Authentication で保護され、Workers から直接は呼べない。Workers からは本番 URL を使う。
- GitHub 連携はしない。連携するとチームの全 PR で Vercel のビルドが走り、Root Directory が違うと失敗するため。公開は上記の CLI で行う。

### 検証結果（#26）

2026-10-17に確認。

| 項目               | 結果                                                                                                       |
| ------------------ | ---------------------------------------------------------------------------------------------------------- |
| URL                | `https://tka-2604-solver.vercel.app`（個人アカウント `minmmmmin` のプロジェクト `tka-2604-solver`）        |
| ビルド             | `uv.lock` から依存を導入して成功。関数サイズ 77.5MB（Python の標準上限 500MB 内）、リージョン `iad1`       |
| `/health`          | 200。応答 0.2〜0.5秒（日本から計測）                                                                       |
| `/probe`           | 200・`OPTIMAL`。CP-SAT の計算 0.003〜0.09秒、応答全体 0.2〜0.5秒。OR-Tools 9.15.6755                       |
| 認証               | トークン誤り・なしで 401                                                                                   |
| 実行時間の上限     | Vercel の関数は既定・最大とも 300秒（Hobby）。CP-SAT の探索上限はこれより十分短くし、BE の待機上限と分ける |
| 秘密情報の管理場所 | Vercel の環境変数 `SOLVER_API_TOKEN`（Production・Secret。値は後から読み出せない）                         |

未検証：コールドスタート時間、30〜40バンドでの計算時間（#34）、Workers からの呼び出し（#27・#28）。

## 制約モデルの生成

正本は `apps/schema/*.schema.json`、生成入口は `constraint.schema.json` です。生成ファイルは直接編集せず、スキーマを変更して再生成します。

リポジトリルートから Python のモデルを生成します。

```sh
npm run codegen:py
```

TypeScript と Python の両方を生成する場合は、ルートの npm 依存関係をインストールしたうえで実行します。

```sh
npm run codegen
```
