# 出演順の計算API（#20・#28）

`POST /api/events/{eventId}/solve`。ボタン（#29）と明確な生成依頼を扱うchat（#47）で、同じ`solveService.execute(eventId, input)`を使う。chatの意図判定・履歴保存、画面のボタン接続、Pythonの計算エンドポイント（#27）はこの変更に含めない。

## 入力と型

```json
{ "expectedUpdatedAt": "2026-10-17T00:00:00.000Z" }
```

`expectedUpdatedAt`は必須。#15のイベント詳細・表・制約取得APIで得た更新日時を渡す。存在しない・削除済み・他の仮所有者のイベントは404、古い更新日時は409で、Solverを呼ばない。現在は既存APIと同じ`demo-owner`を使い、認証接続は#57で行う。

- `constraints`省略：DBへ保存された最新の全Constraintを使用する。
- `constraints: [...]`：画面で変更・確認済みの全Constraintを置換する。空配列は全件削除。Schemaとイベント内参照・位置範囲・優先度などを検証し、既存`saveEvent`で原子的に保存してから、保存済みのデータを再取得・検証してSolverへ渡す。保存の失敗・競合時は呼ばない。
- 無効制約は`enabled: false`のままSolverへ渡し、対象ID・部・位置の参照検証と計算から除外する。削除済みバンド／メンバーや古い部・位置を含んでも受理し、結果は`disabled`を要求する。Schema・イベントID・優先度やmin/max等の整合性検証は維持し、有効化時は再び参照を検証する。
- 部・配置・名簿の未保存編集は先に通常の保存処理で保存し、返された最新の更新日時を使う。このAPIに未保存の表や別イベントの名簿を送らない。
- `sourceBandId`などのDBメタデータは受け取らず、同じ制約IDの由来は既存保存処理で保持する。希望原文・変換状態・部名・イベント設定・chat履歴も保持する。

入出力は`src/services/solver/types.ts`の`SolverRequest`・`SolverResult`・`Placement`・`SolveInput`・`SolveResponse`で定義する。`Constraint`は引き続きSchemaの生成型。FEは`AppType`によるHono RPC、chatは同じServiceを使用できる。

Repositoryは既存の`loadEvent`を使い、イベント・名簿・所属・部・配置・制約を同じD1 batchで取得する。保存した`constraint_json`をパース・検証し、名前・希望原文・由来・chat情報を含めず[BE - Solver契約](../BE%20-%20Solver%20API設計.md)の形にする。現在配置はヒントとして送り、hard固定へ変換しない。

## 応答と保存

```json
{
  "result": {
    "eventId": "event-1",
    "status": "feasible",
    "placements": [{ "bandId": "band-1", "partId": "part-1", "order": 0 }],
    "unassignedBandIds": [],
    "constraintResults": []
  },
  "schedule": {
    "eventId": "event-1",
    "updatedAt": "2026-10-17T00:00:01.000Z",
    "bands": [
      {
        "bandId": "band-1",
        "bandName": "A",
        "requestText": null,
        "requestStatus": null
      }
    ],
    "members": [],
    "memberships": [],
    "parts": [{ "partId": "part-1", "partName": null, "sortOrder": 0 }],
    "placements": [{ "bandId": "band-1", "partId": "part-1", "order": 0 }],
    "unassignedBandIds": []
  }
}
```

`optimal`・`feasible`・`partial`は探索状態と任意の`diagnostics`をそのまま返し、再検証を通った配置を保存する。返却する`schedule`は#15の表取得APIと同じDTO。FEはこの表と更新日時を適用でき、再取得しても同じ配置になる。

- 配置と未配置の和集合は全バンドに一致し、欠落・重複・不明IDがない。完全配置の未配置一覧は空。部分配置は配置・未配置が各1件以上ある。
- 部内の`order`は0から連続。空の部も保持する。未配置はBand_Orderに行がない状態とし、架空のPartや空き枠は作らない。
- 全6種類・全params分岐の制約をBEでも再評価する。制約ごとの結果はちょうど1件必要。無効は`disabled`、未配置対象を含むと`unchecked`。未判定を達成として扱わず、判定できるhard違反は拒否する（間隔・範囲・位置・count上限など）。soft未達成は`unmet`として受理する。
- `diagnostics`は省略または`[]`を受理し、返された3項目の型と制約IDへの参照を確認する。`null`は拒否。診断で探索状態・判定・配置を変更しない。
- `infeasible`・`unknown`は`result`内の配置・未配置・達成状況を`null`、`schedule`も`null`として返し、現在配置を保存・変更しない。
- 計算中に名簿・部・条件・配置・設定が更新／削除された場合は、既存の`updatedAt`による原子的保存が409で拒否する。古い計算結果で最新の表を上書きしない。

| HTTP | code                      | 処理                                           |
| ---- | ------------------------- | ---------------------------------------------- |
| 400  | `invalid_input`           | JSON不正                                       |
| 404  | `event_not_found`         | 対象イベントなし                               |
| 409  | `event_save_conflict`     | 呼出し前または結果保存時の更新競合             |
| 422  | `invalid_input`           | リクエスト・イベント内参照・制約の不備         |
| 500  | `internal_error`          | 保存済み制約JSONの破損、DB保存などの内部エラー |
| 502  | `solver_upstream_error`   | 外部HTTPエラー・通信失敗                       |
| 502  | `solver_invalid_response` | JSON・探索状態・配置・達成判定・診断の不正     |
| 503  | `solver_unavailable`      | 接続情報の未設定・不正                         |
| 504  | `solver_timeout`          | 通信待機上限                                   |

エラーは既存APIと同じ`{ error: { code, message, details } }`。外部のエラー本文や資格情報は返さない。失敗時も現在配置を保持する。呼出し前に保存を完了した制約変更は外部失敗時も保持し、失敗後は表・制約を再取得して新しい`updatedAt`で再試行する。

## 接続設定と確認

Workersの`SOLVER_API_URL`はSolverのベースURL（`/solve`を付ける前）。`SOLVER_API_TOKEN`はSolver側と共通のトークン。値はリポジトリルートのGit対象外ファイル`.env.develop` / `.env.main`で管理する。`.env.example`からの作成と設定手順は[環境構築](../../../../docs/setup.md#workersの環境変数)を参照。

ローカル起動では`.env.develop`を読み込む。`npm run deploy:develop` / `npm run deploy:main`では対応するファイルを`--secrets-file`で渡し、URLとトークンをWorkersのSecretへ登録する。ファイルで省略した既存Secretは保持する。`wrangler.jsonc`には型生成・必須設定の確認に使うキー名だけを宣言する。HTTP接続はlocalhostのみ許可し、リダイレクト先へトークンを転送しない。

Solver呼出しの通信待機上限は30秒。レスポンス本文の読込みもこの期限に含め、超過時は通信を中断して504を返す。Solverの探索上限はリクエストに含めず、2MiBを超える応答は拒否する。探索の`unknown`と通信の504を混同しない。

現時点の公開Python APIは疎通用の`/probe`のみで、実サービスの`/solve`接続は#27の実装後に確認する。今回の通常テストでは外部通信を差し替え、D1は実migrationを適用した隔離環境で検証する。公開・Secret登録・本番DB変更はこの作業では行わない。

```sh
npm run test:backend -- apps/backend/test/routes/solve.test.ts apps/backend/test/services/solver apps/backend/test/integrations/solver.test.ts
npm run check
```

#20の完全配置・部分配置・探索状態の共有例は`apps/schema/examples/solver-contract.json`。`request`が共通入力、各`cases`の`constraints`がある場合だけその制約配列へ置換して`response`と比較する。TypeScript・frontend・Pythonで利用できるJSONとし、BEの契約テストから検証する。
