# BE - Solver API設計

## 概要

BEから制約・部・バンド・メンバー・所属・現在配置を受け取り、配置・探索状態・制約ごとの達成状況を返すSolver APIの入出力契約。Pythonの`/solve`実装は#27で扱う。ブラウザから呼ぶbackendのAPIは[計算API](api/solver.md)を参照し、bandCountは計算APIで受け取った画面の組数、それ以外の送信データはDBの保存済み情報から組み立てる。

## API仕様

| 項目                   | 内容               |
| ---------------------- | ------------------ |
| エンドポイント         | `/solve`           |
| HTTPメソッド           | `POST`             |
| 呼出し元 → 呼出し先    | BE → Solver        |
| リクエスト・レスポンス | `application/json` |
| 実行方式               | 同期               |

## リクエスト

`constraints`は[apps/schema/constraint.schema.json](../../schema/constraint.schema.json)と参照先の全6typeに従うオブジェクト配列。各制約の必須項目を満たしたJSONを送る。

例：4バンド・2部。m1はA・C、m2はB・Dに所属する。

```json
{
  "eventId": "event-1",
  "parts": [
    { "partId": "part-1", "sortOrder": 0, "bandCount": 5 },
    { "partId": "part-2", "sortOrder": 1, "bandCount": 5 }
  ],
  "bands": [
    { "bandId": "band-a" },
    { "bandId": "band-b" },
    { "bandId": "band-c" },
    { "bandId": "band-d" }
  ],
  "members": [{ "memberId": "m1" }, { "memberId": "m2" }],
  "memberships": [
    { "bandId": "band-a", "memberId": "m1" },
    { "bandId": "band-c", "memberId": "m1" },
    { "bandId": "band-b", "memberId": "m2" },
    { "bandId": "band-d", "memberId": "m2" }
  ],
  "constraints": [
    {
      "schema_version": "1.0.0",
      "constraint_id": "c-gap-member",
      "event_id": "event-1",
      "source_text": "m1の出演の間に1バンド以上空けたい",
      "type": "min_gap_member",
      "hardness": "hard",
      "priority": null,
      "enabled": true,
      "targets": { "member_id": "m1" },
      "params": { "min_diff": 2, "same_part_only": false }
    },
    {
      "schema_version": "1.0.0",
      "constraint_id": "c-gap-bands",
      "event_id": "event-1",
      "type": "min_gap_bands",
      "hardness": "soft",
      "priority": "high",
      "enabled": true,
      "targets": {
        "band_ids": ["band-b", "band-d"]
      },
      "params": { "min_diff": 2, "same_part_only": false }
    },
    {
      "schema_version": "1.0.0",
      "constraint_id": "c-count",
      "event_id": "event-1",
      "type": "count",
      "hardness": "hard",
      "priority": null,
      "enabled": true,
      "targets": {
        "band_ids": ["band-a", "band-b", "band-c", "band-d"]
      },
      "params": { "scope": "per_part", "min": 2, "max": 2 }
    }
  ],
  "currentPlacements": [
    { "bandId": "band-a", "partId": "part-1", "order": 0 },
    { "bandId": "band-b", "partId": "part-1", "order": 1 }
  ]
}
```

- IDは文字列として送り、Solverは同じIDを返す。例の短いIDは説明用。
- `bands`・`parts`は必須で各1件以上。入力不備はHTTP 422で返す。
- `constraints`は一覧全件。`enabled: false`は計算対象外。
- `currentPlacements`は探索のヒント。DBの配置に削除による欠番がある場合、BEは送信用のヒントだけ部内のバンド順を0から連続に変換する。DBの配置は計算結果が保存されるまで変更しない。未配置バンドは含めず、現在配置がなければ空配列を送る。固定・変更量最小化は意味しない。
- 部・位置・部内順は0始まり。配置の`partId`は文字列ID、制約の`part_ids`は`sortOrder`の番号。全体位置は部順に連結した配置順で、部の境界は間隔を増やさない。
- `parts[].bandCount`は必須で、画面で指定した各部の組数（空き枠を含む0以上の整数）を送る。現在の配置数とは異なり、空の部でも指定値を送る。枠数は計算時のみ受け取り、DBには永続化しない。部の本数に関する制約は引き続き`count`で指定できる。固定位置はhardの`at_position`で指定する。
- 対象ID・所属・位置範囲・hard/priorityの対応を検証し、入力不備と全配置不可を区別する。

## レスポンス

### 状態と返却ルール

| HTTP | status       | 意味                                               |
| ---- | ------------ | -------------------------------------------------- |
| 200  | `optimal`    | 全配置の解あり。最適性が証明された                 |
| 200  | `feasible`   | 全配置でhardを満たす解あり。最適性は未証明         |
| 200  | `partial`    | 部分配置と未配置一覧を取得                         |
| 200  | `infeasible` | 全配置不可と判明し、返せる部分配置も得られなかった |
| 200  | `unknown`    | 返せる配置も全配置不可の証明も得られず探索終了     |
| 422  | ―            | 入力不備                                           |
| 500  | ―            | 内部エラー                                         |

- `optimal / feasible`は全バンドを1回ずつ配置し、`unassignedBandIds: []`を返す。
- `partial`は1件以上の配置と1件以上の未配置を返し、両方を合わせて全バンドを重複なく含める。配置件数が最大であることは保証しない。
- 配置の`order`は各部で0から詰める。未配置は`unassignedBandIds`で表し、部を追加しない。
- 配置を返す場合、入力constraint_idごとに`constraintResults`を1件返す。`met`は達成、`unmet`はsoft未達成、`disabled`は無効、`unchecked`は未配置対象を含むため未判定。
- 部分配置でも、配置済み対象の間隔・範囲・位置のhard違反やcount上限超過など、判定できるhard違反は許さない。未判定を達成として扱わない。
- `infeasible / unknown`は配置・未配置一覧・達成状況をnullとする。内部例外・通信失敗を探索状態へ変換しない。
- 探索・評価方針、探索時間上限、時間切れ時の処理、部分配置へ切り替える条件はSolver担当が決める。返却時は上記statusの意味とhard条件・IDの対応を守る。

### 診断情報（任意）

HTTP 200のレスポンスに`diagnostics`を任意で追加できる。原因や探索終了理由を確認できた場合に返し、診断がなければ省略または`[]`とする（`null`は使わない）。返す場合、各要素の以下3項目は必須。

| フィールド                    | 型       | 説明                                                                          |
| ----------------------------- | -------- | ----------------------------------------------------------------------------- |
| `diagnostics[].code`          | string   | 診断の識別子。例：`hard_constraints_conflict`。                               |
| `diagnostics[].constraintIds` | string[] | 原因として特定した入力の`constraint_id`。該当する制約を特定できなければ`[]`。 |
| `diagnostics[].message`       | string   | Solverが確認した事実の説明。推測を原因として断定しない。                      |

- 原因特定・診断の返却は必須にしない。全原因の列挙や、原因となる制約集合の最小性は保証しない。診断がなくても、原因がないことは意味しない。
- `diagnostics`は`status`・配置・達成状況の意味を変えない。`partial`でも全配置できない原因を返せる。`unknown`を条件の矛盾と断定せず、入力不備（422）・内部エラー（500）は従来の`error`で返す。
- BEは元の制約一覧・計算結果・診断情報をLLMへ渡し、説明や変更案のヒントに使える。LLM連携の実装は本契約の対象外。hard制約を自動で緩めず、変更案はユーザー確認後に適用・再計算する。

### 最適解：HTTP 200

第1部[A, B]、第2部[C, D]。

```json
{
  "eventId": "event-1",
  "status": "optimal",
  "unassignedBandIds": [],
  "placements": [
    { "bandId": "band-a", "partId": "part-1", "order": 0 },
    { "bandId": "band-b", "partId": "part-1", "order": 1 },
    { "bandId": "band-c", "partId": "part-2", "order": 0 },
    { "bandId": "band-d", "partId": "part-2", "order": 1 }
  ],
  "constraintResults": [
    { "constraintId": "c-gap-member", "status": "met" },
    { "constraintId": "c-gap-bands", "status": "met" },
    { "constraintId": "c-count", "status": "met" }
  ]
}
```

### 実行可能解：HTTP 200

第1部[A, B]、第2部[D, C]。hardは達成し、B・Dの間隔のsoftが未達成。

```json
{
  "eventId": "event-1",
  "status": "feasible",
  "unassignedBandIds": [],
  "placements": [
    { "bandId": "band-a", "partId": "part-1", "order": 0 },
    { "bandId": "band-b", "partId": "part-1", "order": 1 },
    { "bandId": "band-d", "partId": "part-2", "order": 0 },
    { "bandId": "band-c", "partId": "part-2", "order": 1 }
  ],
  "constraintResults": [
    { "constraintId": "c-gap-member", "status": "met" },
    { "constraintId": "c-gap-bands", "status": "unmet" },
    { "constraintId": "c-count", "status": "met" }
  ]
}
```

### 部分配置＋原因を特定できた場合：HTTP 200

リクエスト例の`count`を`min: 0, max: 1`へ変更した場合。2部それぞれ最大1バンドのため、4バンド全ては配置できない。全配置不可を確認後、A・Bを配置し、C・Dを未配置で返す。原因を特定できた例として`diagnostics`に`c-count`を含める。

```json
{
  "eventId": "event-1",
  "status": "partial",
  "placements": [
    { "bandId": "band-a", "partId": "part-1", "order": 0 },
    { "bandId": "band-b", "partId": "part-2", "order": 0 }
  ],
  "unassignedBandIds": ["band-c", "band-d"],
  "constraintResults": [
    { "constraintId": "c-gap-member", "status": "unchecked" },
    { "constraintId": "c-gap-bands", "status": "unchecked" },
    { "constraintId": "c-count", "status": "unchecked" }
  ],
  "diagnostics": [
    {
      "code": "hard_constraints_conflict",
      "constraintIds": ["c-count"],
      "message": "全4バンドに対して、2部それぞれ最大1バンドのため、全配置できません。"
    }
  ]
}
```

### 返せる配置なし：HTTP 200

全配置不可を確認したが、返却できる部分配置も得られなかった場合。部分配置まで不可能と証明したことは意味しない。

```json
{
  "eventId": "event-1",
  "status": "infeasible",
  "unassignedBandIds": null,
  "placements": null,
  "constraintResults": null
}
```

### 探索未完了：HTTP 200

```json
{
  "eventId": "event-1",
  "status": "unknown",
  "unassignedBandIds": null,
  "placements": null,
  "constraintResults": null
}
```

### 入力エラー：HTTP 422

```json
{
  "error": {
    "code": "invalid_input",
    "message": "入力データが不正です。",
    "details": [
      {
        "path": "/constraints/2/params/min",
        "reason": "minはmax以下で指定してください。"
      }
    ]
  }
}
```

### 内部エラー：HTTP 500

```json
{
  "error": {
    "code": "solver_internal_error",
    "message": "出演順の計算に失敗しました。",
    "details": []
  }
}
```

## 懸念点・未決定事項

契約の未確定事項は[#20](https://github.com/jphacks/tka_2604/issues/20)、評価方針は[#24](https://github.com/jphacks/tka_2604/issues/24)、実行先・認証・時間上限は[#26](https://github.com/jphacks/tka_2604/issues/26)で管理する。
