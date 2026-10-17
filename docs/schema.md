# 制約と型生成

正本は`apps/schema/*.schema.json`。入口は`constraint.schema.json`、共通部品は`common.schema.json`。

## 制約の意味

| type             | 内容                                                         |
| ---------------- | ------------------------------------------------------------ |
| `min_gap_member` | 指定メンバーの出演バンドを名簿から集め、全ペアを離す         |
| `min_gap_bands`  | 指定バンド集合の全ペアを離す                                 |
| `before`         | 指定した2バンドの全体での前後関係                            |
| `at_position`    | 1バンドの位置固定                                            |
| `in_range`       | 対象全員を位置範囲（両端を含む）または指定部のいずれかに置く |
| `count`          | 各部の本数、または指定部の合計本数を制限する                 |

- 位置・部は0始まり。人は名前でなく`member_id`で識別する。
- 間隔は位置差`min_diff`。間に1バンドなら2、2バンドなら3。
- `same_part_only: true`なら部をまたぐペアには間隔制約を適用しない。
- `enabled: false`は計算・達成判定から除く。`source_text`には元の要望を残せる。
- hardなら`priority: null`、softなら`high` / `mid` / `low`。評価方法は未決定。
- hard/priorityの対応、IDの存在・所属、位置の上限、範囲の大小関係は実装で検証する。

## 生成・変更手順

```sh
npm run codegen
npm run codegen:check
```

生成先はfrontend・backendの`src/generated/constraint.ts`と`apps/solver/src/generated/constraint.py`の3ファイル。手編集せず、スキーマと生成差分を一緒にGit管理する。TypeScriptの型は実行時検証にならず、生成したPydanticモデルにも業務上の検証が必要。

backendの実行時検証は`shared/constraints/schema.ts`で共有Schemaの参照を解決し、Zodの`fromJSONSchema`を利用する。6種類の制約・union分岐・配列の一意性・未知の項目の拒否をテストする。`fromJSONSchema`はZod 4.6の実験的APIのため、Zod更新時もこれらの互換性を確認する。AjvはOpenAPI契約テストにだけ使用し、検証用JavaScript・型宣言の生成は行わない。

チャットの変更案も同じ共通検証を使い、BE管理項目を検証用の値にだけ補う。実際の変更案ではnullableな設定を保持し、BE管理項目は追加しない。詳細は[AIチャット入出力](../apps/backend/docs/AIチャット入出力.md)を参照。

実行時検証とCIが保証する範囲は[バリデーション・チェック・CI](validation-ci.md)を参照。

変更は意味・入力例を決めてから、スキーマ → 再生成 → 検証・計算・表示・テストをそろえる。既存の保存データへの影響も確認する。

## 設計理由

- 人の制約は1件として保持し、計算時にペアへ展開する。名簿変更とGUI管理を簡単にするため。
- `occupy_slots`は使わない。連続枠で本数と幅が等しければ`in_range`と位置の重複禁止で表現する。非連続枠は対象外。
- 意味ごとに分割して`$ref`で参照し、`title`で生成型名を安定させる。
