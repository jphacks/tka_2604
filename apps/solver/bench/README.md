# ソルバーの計測用データ（#34）

ダミーの名簿で `/solve` を呼び、時間・status・hard違反・soft達成を同じ手順で測る。入出力は[BE - Solver API設計](../../backend/docs/BE%20-%20Solver%20API設計.md)に従う。

## 名簿（`data/`）

どちらも「曲名,メンバー1,…,メンバー7」のCSV（1行1バンド、メンバーは名前）。同じ名前は同じ人として掛け持ちになる。

| ファイル        | 内容                                                                                                        |
| --------------- | ----------------------------------------------------------------------------------------------------------- |
| `demo_20.csv`   | デモ用の20組・44人（掛け持ち22人、最大5バンド）。曲・アーティストは実在、人名は架空                         |
| `roster_38.csv` | 実際のライブに近い38組・83人（掛け持ち49人、最大7バンド）。メンバー名はダミー。ソルバー開発で使う名簿と同じ |

ケースのIDはCSVの行順に `band-01`…、メンバーは初出順に `member-001`… を振る（`roster_38.csv` ではダミー番号と一致）。名前はリクエストに含めず、制約の `source_text` だけに使う。

### CSVをリクエストJSONに変換する

名簿だけのリクエスト（制約は空）が欲しいときは `csv_to_request.py` を使う。ケースの生成も同じ変換を使う。

```sh
uv --directory apps/solver run python bench/csv_to_request.py bench/data/roster_38.csv \
  --parts 2 --current > roster_38.request.json
```

- `--parts`：部の数（既定1）。`--current`：CSVの行順に各部へ均等に詰めた配置を `currentPlacements` に入れる（38組・2部なら19組ずつ）。`--event-id`：既定 `live-event-01`。
- 同じ名前は同じ人として扱い、空欄・前後の空白は無視する。CSVでは同名の別人を区別できない。
- 開発・計測用の変換で、プロダクトの名簿取込（#33）とは別。

## ケース

| ケース          | 名簿            | 内容                                                                     | 許容するstatus               |
| --------------- | --------------- | ------------------------------------------------------------------------ | ---------------------------- |
| `demo`          | `demo_20.csv`   | 2部（10/10）。部の本数、掛け持ちの連続禁止、トップ・トリ・前後・部の指定 | optimal / feasible           |
| `standard`      | `roster_38.csv` | 3部（13/13/12）。demoと同じ種類の制約                                    | optimal / feasible           |
| `soft_conflict` | `roster_38.csv` | standardに両立しないsoft（AはBより前／BはAより前）を追加                 | optimal / feasible           |
| `hard_conflict` | `roster_38.csv` | 2バンドが同じ出演位置を要求するhard制約の衝突                            | partial / infeasible         |
| `heavy`         | `roster_38.csv` | 掛け持ち全員に2組以上の間隔を求める                                      | optimal / feasible / unknown |

`cases/{ケース}.request.json` は `/solve` へそのまま送るリクエスト。`cases/{ケース}.expected.json` は次の3つを持つ。

- `allowedStatuses`：返ってよいstatus。全配置できるケースはhardを満たす解が必ずあるため、infeasible・partialは誤り。
- `reference`：hardをすべて満たす配置の一例。最適解とは限らない。
- `referenceResults`：参照配置での制約ごとの判定。softは未達成も含む。

計測ケースには`count`制約を含めない。部ごとの固定枠数を前提にせず、hard競合ケースは対応済みの位置制約で作る。

frontend・backendのテスト入力にも使ってよい。

## 判定（`evaluate.py`）

Solverの返却を入力と突き合わせ、Solver本体の評価（#25）とは独立に確かめる。

- 整合性：欠落・重複、部内orderの連番、statusごとの形（partialは配置と未配置が1件以上、infeasible・unknownはnull）。
- 制約：全体位置（部順に配置済みバンドを連結した0始まりの順番）で判定する。返却の `constraintResults` と違えば不一致として出す。
- 未配置の対象を含み結果が決まらない条件は `unchecked`。配置済みだけで違反が確定した場合、hardは違反、softは `unmet` とする。

## 生成

```sh
uv --directory apps/solver run python bench/generate.py
```

名簿CSVから固定seedで同じデータを再生成する。正解の並びを先に作り、それが満たすhardだけを追加する。`cases/` を手編集せず、生成スクリプトを変えて再生成する（テストで一致を確認する）。

## 計測

ローカルでソルバーを起動し（[起動手順](../README.md#セットアップ起動)）、別のターミナルで実行する。

```sh
SOLVER_API_TOKEN=local uv --directory apps/solver run python bench/measure.py \
  --url http://127.0.0.1:8000 --repeat 5 --label local --out bench/results/local.jsonl
```

- 標準出力にケース別の表（回数・status・秒のp50と最大・hard違反・soft達成・問題のあった回数）、標準エラーに1回ごとの結果を出す。問題があれば終了コード1。
- `--out` には実行先・commit・日時付きでJSON Linesを追記する。ローカル・Vercelなど実行先は `--label` で区別する。
- 時間はHTTPを含む往復。初解までの時間はAPIが返さないため測らない。必要ならSolver側のログで確認する。

## 未対応

`/solve`（#27）の実装後に実測し、許容する探索時間を決める。LLMの応答時間の計測、デモ手順と初期化方法は、チャット・ソルバーの接続後に追加する。
