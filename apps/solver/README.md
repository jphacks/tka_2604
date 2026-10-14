# Python ソルバー

Python 3.13・uv で管理するプロジェクトです。現在は起動用の `src/main.py` と、JSON Schema から生成した Pydantic v2 の制約モデルがあります。最適化処理・HTTP サーバーは未実装です。

## 構成

```text
apps/solver/
  .python-version       # Python 3.13
  pyproject.toml        # 依存関係・コード生成の設定
  uv.lock               # 依存関係のロックファイル
  src/
    main.py             # 実行入口
    generated/
      constraint.py     # 生成された制約モデル（手編集禁止）
```

依存パッケージは Pydantic、開発用パッケージは datamodel-code-generator です。プロジェクト自体のパッケージ化は行いません。

## セットアップ・起動

uv をインストールした環境で実行します。

```sh
cd apps/solver
uv sync --locked
uv run python src/main.py
```

現在の出力は `Hello from solver!` です。

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
