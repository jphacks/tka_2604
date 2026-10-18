# イベントAPI

## 概要

ブラウザ → backendのイベント本体の一覧・作成・詳細取得・設定更新・論理削除と、表・制約の保存および表・制約・チャット履歴の取得API。

イベント本体と表・制約・チャット履歴は個別のGETで取得する。イベント本体の詳細取得は基本情報だけを返す。表にはバンド・メンバー・所属・部・配置・未配置を含める。GETでは保存・LLM変換・Solverを実行しない。

## API仕様

| HTTPメソッド | エンドポイント                      | 役割                         | 成功時 |
| ------------ | ----------------------------------- | ---------------------------- | ------ |
| GET          | `/api/events`                       | イベント一覧と表示用集計     | 200    |
| POST         | `/api/events`                       | イベント作成                 | 201    |
| GET          | `/api/events/{eventId}`             | イベント本体の基本情報取得   | 200    |
| PATCH        | `/api/events/{eventId}`             | イベント本体の設定を部分更新 | 200    |
| DELETE       | `/api/events/{eventId}`             | イベントの論理削除           | 204    |
| GET          | `/api/events/{eventId}/schedule`    | 表・名簿・配置・未配置の取得 | 200    |
| GET          | `/api/events/{eventId}/constraints` | 制約JSONと由来の取得         | 200    |
| POST         | `/api/events/{eventId}/schedule`    | 部・配置・未配置の保存       | 200    |
| POST         | `/api/events/{eventId}/constraints` | 制約一覧の保存               | 200    |
| POST         | `/api/events/{eventId}/solve`       | 保存済みデータから計算・保存 | 200    |
| GET          | `/api/events/{eventId}/chat`        | チャット全履歴の取得         | 200    |

- 呼出し元 → 呼出し先：ブラウザ → backend。本文の形式は`application/json`。削除成功時は本文なし。
- 最終的には認証済みユーザーだけが利用する。認証・セッションは今回実装せず、#57で接続する。
- 認証接続前はRoute内の仮ID定数`demo-owner`を所有者として使う。既存のデモユーザーはseedで事前に投入する。環境変数の設定は不要で、HTTPリクエストから所有者IDを受け取らない。Userの自動作成や所有者未設定のEventは追加しない。
- 認証接続時はRouteのService生成箇所で仮IDを認証済みIDへ置き換える。Service・Repositoryは全操作に所有者IDを渡し、一覧・詳細・更新・削除をその所有者で絞る。
- IDは既存データとの接続のためUUIDに限定しない。イベント作成時のIDはサーバーでUUIDを発行する。部・制約の保存ではクライアントが新規IDを用意する。

- 表・制約・履歴の各取得はイベントの存在・所有者・削除状態を含め、1回のD1 batchで取得する。個別の表と制約を保存に使う場合は`updatedAt`が一致するか確認し、異なれば再取得する。履歴の追加だけでは業務データの更新日時は変わらない。

## リクエスト

### 一覧・詳細取得

ボディなし。一覧にページング・検索・フィルターは追加していない。更新日時の降順、同値ならイベントIDの降順で返す。

```http
GET /api/events
GET /api/events/event-1
GET /api/events/event-1/schedule
GET /api/events/event-1/constraints
GET /api/events/event-1/chat
```

### 作成

```http
POST /api/events
Content-Type: application/json
```

```json
{
  "title": "秋ライブ",
  "date": "2026-11-01",
  "venue": null,
  "description": null
}
```

`title`だけが必須。前後の空白を除去し、空文字・空白のみ・文字列以外は拒否する。名称の長さ上限は今回追加しない。`date`は実在する`YYYY-MM-DD`、または`null`。`date`・`venue`・`description`は省略時に`null`になる。`venue`・`description`の空文字はそのまま保持する。

状態は`planning`で開始し、空の第1部を同じD1 batchで作成する。状態・所有者・IDなど、定義外のフィールドは拒否する。

### 設定更新

```http
PATCH /api/events/event-1
Content-Type: application/json
```

```json
{
  "expectedUpdatedAt": "2026-10-17T00:00:00.000Z",
  "title": "秋ライブ2026",
  "venue": "大学ホール",
  "status": "adjusting"
}
```

- `expectedUpdatedAt`に取得時の`updatedAt`をそのまま渡す。UTCのISO 8601文字列を必須とする。
- 更新対象は`title`・`date`・`venue`・`description`・`status`。少なくとも1項目を指定する。
- 省略した項目は保持し、任意項目を消去する場合は`null`。`title`・`status`は`null`不可。
- `status`は`planning`・`adjusting`・`confirmed`。今回、状態間の遷移制限は追加しない。
- 所有者・論理削除・更新日時をSQLの更新条件で再確認する。同時保存は片方だけ成功し、古い更新は409で保存しない。更新後の日時は前回より必ず1ミリ秒以上進める。
- 表・名簿・制約・チャットなどは変更しない。定義外の項目を拒否する。

### 論理削除

ボディなし。

```http
DELETE /api/events/event-1
```

既存の内部`deleteEvent`処理を使い、`is_deleted=1`にする。配下のBand・Member・所属・Part・配置・希望・制約・チャット履歴は保持する。通常の一覧・詳細・更新対象から外し、削除済みIDへの再実行は404。

## レスポンス

### イベント本体

作成は201と`Location: /api/events/{eventId}`、詳細取得・設定更新は200で同じ構造を返す。更新応答には保存後の値と`updatedAt`が入る。

```json
{
  "eventId": "event-1",
  "title": "秋ライブ",
  "status": "planning",
  "date": "2026-11-01",
  "venue": null,
  "description": null,
  "createdAt": "2026-10-17T00:00:00.000Z",
  "updatedAt": "2026-10-17T00:00:00.000Z"
}
```

DBの所有者・論理削除フラグやパスワード情報を返さない。frontendの`id`・`name`との変換は#19のRepositoryで行う。

### 一覧

HTTP 200。対象がなければ`{"events":[]}`。

```json
{
  "events": [
    {
      "eventId": "event-1",
      "title": "秋ライブ",
      "status": "planning",
      "date": "2026-11-01",
      "venue": null,
      "description": null,
      "createdAt": "2026-10-17T00:00:00.000Z",
      "updatedAt": "2026-10-17T00:00:00.000Z",
      "performanceCount": 3,
      "assignedCount": 2,
      "partCount": 2,
      "responseCount": null
    }
  ]
}
```

| 項目             | 定義                                                                            |
| ---------------- | ------------------------------------------------------------------------------- |
| performanceCount | 未配置を含む登録バンド数                                                        |
| assignedCount    | 配置済みバンド数。未配置はBand_Orderに行がない状態                              |
| partCount        | 空の部も含む部数                                                                |
| responseCount    | 現段階では`null`。回答数の定義・保存先が#33・#58で未確定のため。0件とは扱わない |

集計は別々のサブクエリで数え、バンド数・部数のJOINによる重複集計を防ぐ。

### 削除成功

HTTP 204。レスポンス本文・Content-Typeなし。

### 表：GET /schedule

HTTP 200。バンドとメンバー、掛け持ちを示す所属を含め、表を復元できるようにする。

```json
{
  "eventId": "event-1",
  "updatedAt": "2026-10-17T00:00:00.000Z",
  "bands": [
    {
      "bandId": "band-1",
      "bandName": "バンドA",
      "requestText": null,
      "requestStatus": null
    },
    {
      "bandId": "band-2",
      "bandName": "バンドB",
      "requestText": null,
      "requestStatus": null
    }
  ],
  "members": [{ "memberId": "member-1", "memberName": "田中" }],
  "memberships": [
    { "bandId": "band-1", "memberId": "member-1" },
    { "bandId": "band-2", "memberId": "member-1" }
  ],
  "parts": [{ "partId": "part-1", "partName": "第1部", "sortOrder": 0 }],
  "placements": [{ "bandId": "band-1", "partId": "part-1", "order": 0 }],
  "unassignedBandIds": ["band-2"]
}
```

- 空の部も取得する。`sortOrder`・`order`は0始まり。部は`sortOrder`、配置は部の順・`order`で並べる。バンドと未配置は`bandId`、メンバーは`memberId`、所属は`bandId`・`memberId`の昇順。
- 未配置は配置行がないバンド。各部の設定枠数は`bandCount`として返し、空き枠は設定枠数と配置件数から画面で組み立てる。
- 希望原文・変換状態は名簿側に付け、制約JSON・チャット履歴は別取得とする。
- `updatedAt`は業務データの更新日時。表と制約を別取得して保存する際の競合確認に使う。

### 制約：GET /constraints

HTTP 200。有効・無効を含む全保存済み制約を`constraint_id`昇順で返す。制約なしは`constraints: []`。

```json
{
  "eventId": "event-1",
  "updatedAt": "2026-10-17T00:00:00.000Z",
  "constraints": [
    {
      "constraint": {
        "schema_version": "1.0.0",
        "constraint_id": "constraint-1",
        "event_id": "event-1",
        "type": "at_position",
        "hardness": "hard",
        "priority": null,
        "enabled": true,
        "source_text": "Aを先頭に固定",
        "targets": { "band_id": "band-1" },
        "params": { "position": 0 }
      },
      "sourceBandId": null
    }
  ]
}
```

`constraint`は共有Constraint JSONをパース・検証したオブジェクト。`sourceBandId`はフォーム希望の生成元を示すメタデータで、共有JSONへ混ぜない。手動・チャット由来などは`null`。実行時検証は`shared/constraints/schema.ts`で共有JSON Schemaを参照し、既存のZodで行う。JSONの形式・列とJSONのID一致・hard/priorityの対応を確認する。不正な保存データは500とし、黙って除外しない。OpenAPIのConstraint定義は同じ正本から参照を移して掲載し、テストで正本との差分と実応答を照合する。

### チャット：GET /chat

HTTP 200。1イベント1会話として`seq`昇順。履歴なしは`messages: []`。

```json
{
  "eventId": "event-1",
  "messages": [
    {
      "messageId": "message-1",
      "seq": 0,
      "role": "user",
      "text": "Aを先頭に固定して",
      "replyToMessageId": null,
      "createdAt": "2026-10-17T00:00:00.000Z"
    },
    {
      "messageId": "message-2",
      "seq": 1,
      "role": "assistant",
      "text": "バンドAを先頭に固定する条件を確認してください。",
      "replyToMessageId": "message-1",
      "createdAt": "2026-10-17T00:00:01.000Z"
    }
  ]
}
```

ページング・件数上限は設けず、保存済みの全履歴を返す。ユーザー発言の回答元は`null`、assistantは同イベントの先行userのID。本文以外の内部推論やAPIキーは含めない。発言だけの追加ではEvent.updatedAtは変わらないため、履歴の更新判定に業務データの更新日時だけを使わない。

### エラー

| HTTP | error.code          | 意味                                           |
| ---- | ------------------- | ---------------------------------------------- |
| 400  | invalid_input       | JSON構文不正                                   |
| 404  | event_not_found     | 存在しない・削除済み・対象所有者以外のイベント |
| 409  | event_save_conflict | 取得後に更新済み。保存せず再取得を促す         |
| 422  | invalid_input       | 名称・日付・状態・更新日時・フィールド等の不正 |
| 500  | internal_error      | DB・内部処理の失敗。内部例外は返さない         |

不正入力例（HTTP 422）：

```json
{
  "error": {
    "code": "invalid_input",
    "message": "入力データが不正です。",
    "details": [
      { "path": "/title", "reason": "イベント名を入力してください。" }
    ]
  }
}
```

存在しないイベントの例（HTTP 404）：

```json
{
  "error": {
    "code": "event_not_found",
    "message": "イベントが見つかりません。",
    "details": []
  }
}
```

## 懸念点・未決定事項

- チャット送信・再試行・LLM連携は#47の後続範囲。表・制約のHTTP保存はこの資料のPOSTを使う。
- 認証自体は未実装。#57でRoute内の仮IDを認証済みユーザーIDへ置き換える。`demo-owner`は事前にDBへ投入する。定数による所有者の指定は認証を代替しない。
- 公開フォームの取得・回答受付は#58・#46で実装し、削除済みイベントを対象外にする判定を揃える。今回フォームAPIは追加しない。
- `responseCount`の数値化は#33・#58の合意後。バンド数から推測しない。
- 計算中の更新は許可し、結果保存時の`updatedAt`競合検出で古い結果の上書きを拒否する。計算APIは[計算API](solver.md)を参照。

ローカル確認は[API手順](README.md)・[セットアップ](../../../../docs/setup.md)を参照。

## 表と制約の保存

### 表：POST /api/events/{eventId}/schedule

部・配置・未配置をまとめて置き換える。名簿・所属・希望原文・制約・チャットは保持する。`parts`の配列順が0始まりの部順となり、空の部も保存する。`bandCount`は各部の設定枠数で、配置数とは独立して保存する。省略時は既存の値、新規部は4を使う。変更・新規は1〜20組、部数は1〜8。配置数は設定枠数以下とし、配置のorderの欠番で未設定位置を保持する。空き枠の行は入力しない。

```json
{
  "expectedUpdatedAt": "2026-10-17T00:00:00.000Z",
  "parts": [{ "partId": "part-1", "partName": "前半", "bandCount": 4 }],
  "placements": [{ "bandId": "band-1", "partId": "part-1", "order": 0 }],
  "unassignedBandIds": ["band-2"]
}
```

全バンドを配置と未配置に1回ずつ含める。部内の`order`は0始まりの重複しない整数。欠番は未設定の位置として保持する。orderの上限は、20枠・登録バンド数・保存済み最大order+1の最大値未満。最後の部・残っている制約から参照される部は削除できない。配置済みの部を削除するときは、同じ入力でバンドを移動または未配置へ戻す。手動配置のhard違反は保存を妨げず、自動修正しない。部の並べ替えで制約JSONの番号を書き換えない。

HTTP 200はGET `/schedule`と同じ形式で、保存後の`updatedAt`を返す。

### 制約：POST /api/events/{eventId}/constraints

```json
{
  "expectedUpdatedAt": "2026-10-17T00:00:00.001Z",
  "constraints": []
}
```

`constraints`は共有Constraintオブジェクトの配列で、一覧全件を置き換える。`[]`は全削除。共有Schema・イベントID・hard/priority・対象ID・部・位置・min/maxを検証する。無効制約は形式と数値の関係を検証し、古い対象・部・位置の参照を許容する。既存IDの`sourceBandId`は保持し、新規IDは`null`。名簿・所属・部・配置・希望原文・チャットは保持する。

HTTP 200はGET `/constraints`と同じ形式で、保存後の`updatedAt`を返す。

### 独立した保存APIとエラー

2本の保存APIは独立しており、呼出し順序や保存後に計算するかどうかはフロント側で制御する。更新時刻はイベント単位で共通のため、次の更新には直前の成功応答の`updatedAt`を渡す。各リクエストは原子的に保存するが、複数のリクエスト全体をまとめたトランザクションはない。ある保存の失敗で別の成功済み保存は取り消されない。保存API自体は計算を実行しない。

両APIとも、JSON不正は400、対象なし・他所有者・削除済みは404、更新競合は409、形式・所属・配置・制約の不備は422、DB等の内部失敗は500。エラー形式は既存の`{ error: { code, message, details } }`。DB書込み失敗時は更新日時を含めbatch全体をロールバックする。競合時は最新状態を再取得する。

## 作成時の部構成（#91）

作成入力の`bandCounts: [4, 5, 4]`は、部順に4・5・4組の3部を作る。省略時は1部4組。各部1〜20、部数1〜8の整数のみ許可する。部は空で作成し、ダミーのバンドは追加しない。

配置と設定枠数は表保存APIで同時に保存する。部・枠を減らす画面操作では収まらないバンドを未配置へ戻し、固定位置や部参照を壊す変更は画面で拒否する。ダイアログの「適用」はローカル編集で、上部の「保存」で永続化する。移動・計算結果・再取得で設定値を増減しない。
