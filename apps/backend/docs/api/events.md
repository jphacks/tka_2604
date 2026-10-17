# イベントAPI（#15）

## 概要

ブラウザ → backendのイベント本体の一覧・作成・詳細取得・設定更新・論理削除を実装する。

イベント本体と、表情報・制約情報・チャット情報は取得APIを分ける。本Issueの詳細取得はイベント本体だけを返す。表は`GET /api/events/{eventId}/schedule`、制約は`GET /api/events/{eventId}/constraints`、チャット履歴は合意済みの`GET /api/events/{eventId}/chat`を後続Issueで実装する。`/all`は設けない。

## API仕様

| HTTPメソッド | エンドポイント          | 役割                         | 成功時 |
| ------------ | ----------------------- | ---------------------------- | ------ |
| GET          | `/api/events`           | イベント一覧と表示用集計     | 200    |
| POST         | `/api/events`           | イベント作成                 | 201    |
| GET          | `/api/events/{eventId}` | イベント本体の基本情報取得   | 200    |
| PATCH        | `/api/events/{eventId}` | イベント本体の設定を部分更新 | 200    |
| DELETE       | `/api/events/{eventId}` | イベントの論理削除           | 204    |

- 呼出し元 → 呼出し先：ブラウザ → backend。本文の形式は`application/json`。削除成功時は本文なし。
- 最終的には認証済みユーザーだけが利用する。認証・セッションは今回実装せず、#57で接続する。
- 認証接続前はサーバー設定`EVENTS_USER_ID`で指定した既存Userのイベントだけを扱う。認証を代替する仕組みではなく、HTTPリクエストから所有者IDを受け取らない。未設定・空欄なら503。Userの自動作成や所有者未設定のEventは追加しない。
- 認証接続時はRouteのService生成箇所で仮IDを認証済みIDへ置き換える。Service・Repositoryは全操作に所有者IDを渡し、一覧・詳細・更新・削除をその所有者で絞る。
- IDは既存データとの接続のためUUIDに限定しない。新規IDはサーバーでUUIDを発行する。

## リクエスト

### 一覧・詳細取得

ボディなし。一覧にページング・検索・フィルターは追加していない。更新日時の降順、同値ならイベントIDの降順で返す。

```http
GET /api/events
GET /api/events/event-1
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

### エラー

| HTTP | error.code                 | 意味                                           |
| ---- | -------------------------- | ---------------------------------------------- |
| 400  | invalid_input              | JSON構文不正                                   |
| 404  | event_not_found            | 存在しない・削除済み・対象所有者以外のイベント |
| 409  | event_save_conflict        | 取得後に更新済み。保存せず再取得を促す         |
| 422  | invalid_input              | 名称・日付・状態・更新日時・フィールド等の不正 |
| 500  | internal_error             | DB・内部処理の失敗。内部例外は返さない         |
| 503  | event_owner_not_configured | 認証前のサーバー側所有者設定が空欄             |

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

- 認証自体は未実装。#57で認証済みIDへ接続し、仮設定を撤去する。設定したUserは事前にDBへ投入する。サーバーにIDを設定してもログイン済みにはならない。
- 公開フォームの取得・回答受付は#58・#46で実装し、削除済みイベントを対象外にする判定を揃える。今回フォームAPIは追加しない。
- `responseCount`の数値化は#33・#58の合意後。バンド数から推測しない。
- 生成中の編集禁止は#28の期限付き生成ロックと接続する際に揃える。このブランチの起点には生成API・ロック列がなく、設定更新のロック条件・409応答はその接続時に追加する。削除は既存`deleteEvent`を呼ぶため、そのロック対応を引き継ぐ。

ローカル確認は[API手順](README.md)・[セットアップ](../../../../docs/setup.md)を参照。
