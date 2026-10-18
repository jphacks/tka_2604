# 計算API

## 概要

ブラウザ → backendの計算API。表と制約の保存APIとは独立している。backendはリクエストで各部の組数を受け取り、配置・制約は呼び出された時点の保存済みデータをD1から読み、Solverへ渡す。APIを呼ぶ順番や、保存後に計算するかどうかはフロント側の責務。

## API仕様

| 項目                | 内容                                |
| ------------------- | ----------------------------------- |
| エンドポイント      | `/api/events/{eventId}/solve`       |
| HTTPメソッド        | POST                                |
| 呼出し元 → 呼出し先 | ブラウザ → backend                  |
| 本文                | `application/json`                  |
| 所有者              | 現在は`demo-owner`。認証は#57で接続 |

## リクエスト

```json
{
  "expectedUpdatedAt": "2026-10-17T00:00:00.002Z",
  "parts": [
    { "partId": "part-1", "bandCount": 5 },
    { "partId": "part-2", "bandCount": 5 }
  ]
}
```

- `expectedUpdatedAt`は最後に取得・保存したイベントの更新時刻。表・制約・設定で共通。配置や制約の配列を含む入力は422とする。
- `parts`は必須。保存済みの全ての部IDを重複なく指定する。`bandCount`は画面の組数（空き枠を含む0以上の整数）で、欠落・負数・小数・不明な部・重複・部の不足は422。部の並びは保存済みの`sortOrder`を使う。枠数は計算時のみ使用し、DBには保存しない。
- 表・制約を先に保存する場合の呼出し・成功判定・順序制御はフロント側で行う。backendに3本のAPIをまとめて呼ぶ処理は設けない。
- イベント・名簿・所属・部・配置・制約は同じD1 batchで取得する。共有Schema・業務ルールを検証し、各部の組数を部IDで照合して追加し、部とID、所属、全制約、現在配置を[Solver契約](<../BE - Solver API設計.md>)へ変換する。名前・希望の原文・由来・チャット等のDBメタデータは追加しない。制約内の`source_text`は共有JSONの一部として保持する。
- `currentPlacements`は探索のヒント。位置固定や変更量最小化へ変換しない。無効制約も`enabled: false`のまま送る。探索時間上限は送らない。

## レスポンス

HTTP 200。`result`はSolver契約の探索状態・配置・未配置・制約達成状況・任意の診断。`schedule`は検証と保存に成功した表で、GET `/schedule`と同じ形式。

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
    "updatedAt": "2026-10-17T00:00:00.003Z",
    "bands": [
      {
        "bandId": "band-1",
        "bandName": "バンドA",
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

`optimal`・`feasible`は全バンドを配置する。`partial`は配置と未配置の両方を返し、部分配置を保存する。未配置用の部は作らない。部内順・全バンドの欠落／重複・全6typeのhard違反・制約達成状況・診断IDをBEでも再検証する。softの未達成は受理する。

`infeasible`・`unknown`は`result.placements`・`unassignedBandIds`・`constraintResults`と`schedule`が`null`。現在配置と更新時刻は変更しない。通信エラーを探索状態として返さない。

| HTTP | code                      | 内容                                   |
| ---- | ------------------------- | -------------------------------------- |
| 400  | `invalid_input`           | JSON不正                               |
| 404  | `event_not_found`         | 存在しない・他所有者・削除済み         |
| 409  | `event_save_conflict`     | 呼出し前または結果保存時の更新競合     |
| 422  | `invalid_input`           | 入力・保存済みデータの業務上の不備     |
| 500  | `internal_error`          | 保存済み制約JSONの破損・DB等の内部失敗 |
| 502  | `solver_upstream_error`   | 外部HTTP・通信エラー                   |
| 502  | `solver_invalid_response` | 形式・ID・配置・制約判定等の不正       |
| 503  | `solver_unavailable`      | 接続設定の未設定・不正                 |
| 504  | `solver_timeout`          | 通信待機上限を超過                     |

エラーは既存の`{ error: { code, message, details } }`。外部のエラー本文やトークンは返さない。結果保存は読み込み時の`updatedAt`で競合を検出し、計算中に更新・削除されたデータを古い結果で上書きしない。DB書込み失敗時はbatch全体をロールバックする。

## 接続設定・確認

リポジトリルートの`.env.develop` / `.env.main`で`SOLVER_API_URL`（`/solve`を付ける前のベースURL）と`SOLVER_API_TOKEN`を設定する。`.env.example`をコピーして用意し、実ファイルはGit対象外とする。ローカル起動は`.env.develop`を読み込む。`.dev.vars`がある場合はenvファイルへ移す。

`npm run deploy:develop` / `npm run deploy:main`は対応するenvファイルを`--secrets-file`で読み、WorkersのSecretとして登録する。ファイルで省略した既存Secretは保持する。`wrangler.jsonc`に値は置かず、型生成用のキー名だけ宣言する。

通信待機上限は本文の読込みも含め30秒。2MiBを超える応答は拒否する。リダイレクトは追従せず、HTTP接続はlocalhostのみ許可する。

## 懸念点・未決定事項

`bandCount`の受け取りにはSolver側の対応が必要。今回の送信側変更にはPython Solverの変更を含めず、リポジトリ内の従来のPartモデルは追加フィールドを拒否するため、そのままでは実Solver E2Eは通らない。Vercel側の対応版との疎通は別途確認する。

Pythonの実`/solve`と、フロントの「自動生成」からの接続は実装済み。通常の単体テストでは外部通信を差し替え、`npm run test:e2e:solver`ではローカルの実Solverと専用D1を使って画面から検証する。[起動・確認手順](../../../../docs/setup.md#実solverを含めたe2e)を参照。公開先の実Solver・本番DBの確認はこのテストに含まない。

現状のPython Solverは`count`を探索・評価しない（#75で方針検討中）。有効な`count`を含む応答はBEの再検証で拒否されるため、この制約を使う計算は未対応。hardを自動で緩めたり、条件を削除して再計算したりはしない。
