# イベント情報取得APIの叩き台

## 概要

ブラウザ → backendの取得API案。イベント本体・表・制約・チャットを個別に取得でき、初期表示などでは`/all`からまとめて取得できるようにする。

**イベント本体は#15で実装済み。この資料の`/schedule`・`/constraints`・`/chat`・`/all`は仕様案で、HTTP APIは未実装。** Swaggerにも「未実装・仕様案」として掲載する。現状の実行結果はHTTP 404の`{"error":"Not Found"}`。以下のフィールド・応答はレビュー用の案であり、実装完了を示さない。

イベント本体の実装済み契約は[イベントAPI](events.md)、制約の正本は[共有Schema](../../../schema/constraint.schema.json)、履歴・由来は[AIチャット設計](../AIチャット設計.md)を参照する。

## API仕様

| HTTPメソッド | エンドポイント                      | 返す情報                                  | 状態            |
| ------------ | ----------------------------------- | ----------------------------------------- | --------------- |
| GET          | `/api/events/{eventId}`             | イベント本体の基本情報                    | 実装済み（#15） |
| GET          | `/api/events/{eventId}/schedule`    | バンド・メンバー・所属・部・配置・未配置  | 仕様案（#18等） |
| GET          | `/api/events/{eventId}/constraints` | 保存済み制約JSONと由来                    | 仕様案（#18）   |
| GET          | `/api/events/{eventId}/chat`        | イベント内のチャット履歴                  | 仕様案（#47）   |
| GET          | `/api/events/{eventId}/all`         | 上記4種類をまとめた情報。チャットは全履歴 | 仕様案          |

- 呼出し元 → 呼出し先：ブラウザ → backend。レスポンスは`application/json`。
- 最終的には認証必須。#57の認証接続前は既存APIと同じ`demo-owner`を想定し、クライアントから所有者IDは受け取らない。
- 存在しない・削除済み・他所有者のイベントは配下を含めて取得対象外とする。
- GETでは保存・制約変換・計算を実行しない。

## リクエスト

全てボディなし。`eventId`をパスに指定する。

```http
GET /api/events/event-1/schedule
GET /api/events/event-1/constraints
GET /api/events/event-1/chat
GET /api/events/event-1/all
```

`/chat`のページングは#47で方式・上限を確定する。現段階ではクエリ名や既定件数を確定しない。`/all`の「全履歴」と個別履歴のページングは分けて検討する。

## レスポンス

### 表：GET /schedule

成功時HTTP 200の案。バンドとメンバー、掛け持ちを示す所属を含め、表を復元できるようにする。

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

- 空の部も取得する。`sortOrder`・`order`は0始まり。部は`sortOrder`、配置は部の順・`order`で並べる案。
- 未配置は配置行がないバンド。DBにない枠数・空き枠を永続化された値として返さない。
- 希望原文・変換状態は名簿側に付け、制約JSON・チャット履歴は別取得とする。
- `updatedAt`は業務データの更新日時。表と制約を別取得して保存する際の競合確認に使う案。

### 制約：GET /constraints

成功時HTTP 200の案。有効・無効を含む全保存済み制約を返す。制約なしは`constraints: []`。

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

`constraint`は共有Constraint JSONをパース・検証したオブジェクト。`sourceBandId`はフォーム希望の生成元を示すメタデータで、共有JSONへ混ぜない。手動・チャット由来などは`null`。OpenAPIでは6種類の制約を再定義せず、詳細型の参照・検証を#18の実装時に接続する。現在の仕様案の`object`型は完全な制約検証を表さない。

### チャット：GET /chat

成功時HTTP 200の案。1イベント1会話として`seq`昇順。履歴なしは`messages: []`。

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

ページング用クエリ・メタデータは未確定。ユーザー発言の回答元は`null`、assistantは同イベントの先行userのID。本文以外の内部推論やAPIキーは含めない。発言だけの追加ではEvent.updatedAtは変わらないため、履歴の更新判定に業務データの更新日時だけを使わない。

### 一括：GET /all

成功時HTTP 200の案。`event`は実装済みのイベント本体と同じ形、`schedule`・`constraints`・`chat`は個別APIと同じ構造を入れる。下記は新規イベントで名簿・制約・履歴がない場合。

```json
{
  "event": {
    "eventId": "event-1",
    "title": "秋ライブ",
    "status": "planning",
    "date": "2026-11-01",
    "venue": null,
    "description": null,
    "createdAt": "2026-10-17T00:00:00.000Z",
    "updatedAt": "2026-10-17T00:00:00.000Z"
  },
  "schedule": {
    "eventId": "event-1",
    "updatedAt": "2026-10-17T00:00:00.000Z",
    "bands": [],
    "members": [],
    "memberships": [],
    "parts": [{ "partId": "part-1", "partName": null, "sortOrder": 0 }],
    "placements": [],
    "unassignedBandIds": []
  },
  "constraints": {
    "eventId": "event-1",
    "updatedAt": "2026-10-17T00:00:00.000Z",
    "constraints": []
  },
  "chat": { "eventId": "event-1", "messages": [] }
}
```

全情報が揃った場合に200とし、一部だけ取得できた応答を成功として返さない案。`/all`のチャットは全履歴を対象とし、個別APIの先頭ページだけを全件として扱わない。返すのは管理画面に必要な情報で、パスワード・所有者等の内部管理情報は含めない。

### 実装後のエラー案

| HTTP | error.code      | 意味                                             |
| ---- | --------------- | ------------------------------------------------ |
| 404  | event_not_found | 存在しない・削除済み・他所有者のイベント         |
| 500  | internal_error  | 取得・保存済みJSONの復元等に失敗。内部例外は隠す |

HTTP 404の予定例。現在の未実装ルートの404とは区別する。

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

- `/schedule`と`/constraints`のフィールド・並び順・保存DTOとの対応は#18・#19で確認する。個別取得の更新日時が異なった場合の再取得方法も合わせる。
- `/chat`のページング方式・クエリ名・件数上限・カーソルの形は#47で確定する。送信・再試行APIはこの取得API案とは別に定義する。
- `/all`の全履歴取得のサイズ上限・上限超過時の応答、業務データとチャットを同じ時点で読む方法は実装前に確定する。既存のGETを並列に呼ぶだけで一貫した状態が得られるとは扱わない。
- `/all`の実装担当は未割当。個別API・共通Repositoryの実装と接続して決める。
- 認証は#57。詳細SchemaのOpenAPI参照と契約テスト対応は各APIの実装時に追加し、仕様案だけで実装・検証済みとはしない。
