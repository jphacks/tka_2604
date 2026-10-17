# チャット送信 API定義書

## 概要

ユーザー発言をD1へ保存してからGeminiを呼び、検証済み応答の`message`本文をassistant発言として保存する。保存完了後、frontendへ返信する。既存の`chat_messages`を使い、追加のテーブル・migrationはない。

## API仕様

| 項目                   | 内容                                                                    |
| ---------------------- | ----------------------------------------------------------------------- |
| エンドポイント         | `/api/events/:eventId/chat`                                             |
| HTTPメソッド           | POST                                                                    |
| 呼出し元 → 呼出し先    | frontendのチャット → Hono backend → Gemini                              |
| リクエスト・レスポンス | application/json                                                        |
| 認証                   | #57で接続予定。現在はサーバー側の仮ID`demo-owner`の有効なイベントに限定 |

## リクエスト

```json
{ "message": "出演間隔を空けたい", "messageId": "chat-user-1" }
```

- `message`は1〜1000文字。前後の空白を除去し、空白だけなら422。
- `messageId`は省略可能で、指定時は英数字・`_`・`-`からなる1〜128文字。同じ発言の再送には同じID・本文を使う。省略時はBEが発行する。
- 定義外の項目・不正な型は422。クライアントから所有者IDや最新状態・履歴は受け取らない。

処理順序：

1. 入力とイベントの所有者・論理削除を確認し、user発言を保存する。同じID・本文があれば再利用する。
2. 対応するassistant発言が保存済みなら、その本文を返してLLMを呼ばない。
3. 最新のイベント・名簿・配置・制約と、今回の発言より前の履歴を取得する。今回の発言は`userMessage`に分け、過去の直近6メッセージをLLMへ渡す。
4. LLMの応答形式・対象ID・制約を検証する。`message`本文だけをassistantの`text`へ保存し、`replyToMessageId`でuserへ紐づける。
5. 保存したassistant本文を返す。

採番はINSERT内で原子的に行い、同じuserへのassistant回答は一意とする。並行再送でLLMが複数回呼ばれることはあるが、DBの回答は1件で、先に保存された回答を返す。会話の保存でイベントの`updatedAt`は更新しない。

## レスポンス

200（回答保存済み、または同じ発言の保存済み回答）：

```json
{ "reply": "必要な出演間隔を教えてください。" }
```

入力検証後に確定した発言IDを`X-Chat-Message-Id`レスポンスヘッダーへ返す。LLM失敗後もこのIDを再送に使う。入力検証前の400・422では発言IDは確定せず、保存も行わない。

PR #60のイベントAPIと同じ`{ error: { code, message, details } }`でエラーを返す。

| HTTP | code                  | 内容                                                         |
| ---- | --------------------- | ------------------------------------------------------------ |
| 400  | invalid_input         | 壊れたJSON                                                   |
| 422  | invalid_input         | 本文・発言IDの欠落や型・長さ・定義外項目などの不正入力       |
| 404  | event_not_found       | 不存在・他所有者・削除済み。回答保存前に削除された場合も含む |
| 409  | event_save_conflict   | 最新状態の取得時点が一致しない                               |
| 409  | chat_message_conflict | 同じ発言IDを別の本文・イベント・roleへ再利用した             |
| 500  | internal_error        | DB・設定等の内部処理の失敗                                   |
| 502  | ai_chat_failed        | LLM通信・拒否・未完了・応答検証の失敗                        |
| 504  | ai_chat_failed        | LLMタイムアウト                                              |

```json
{
  "error": {
    "code": "invalid_input",
    "message": "入力データが不正です。",
    "details": [
      { "path": "/message", "reason": "入力内容を確認してください。" }
    ]
  }
}
```

422のdetailsには項目ごとのpathとreasonを返す。その他は空配列。内部例外やLLMのエラー本文は公開しない。

ユーザー発言保存後の失敗では、ユーザー発言を保持する。LLM失敗・出力不正・assistant保存失敗の場合はassistantを追加しない。同じID・本文で再送すると、未回答なら再生成し、保存済みなら既存回答を返す。

## 懸念点・未決定事項

- 内部のLLM出力は`type`・`message`・`actions`を持つが、この送信APIの応答と履歴には本文だけを使う。承認待ち案の管理、`type`・`actions`を返すHTTP契約、制約の適用・Solver実行は後続。未承認のactionsを履歴や完成済み制約として保存しない。
- frontendは引き続き`reply`を表示できるが、画面の名簿はモックのためDBイベントとの同期は#19で接続する。画面での履歴復元・再送IDの保持も後続。IDを省略した送信では、本文が同じでも新しい発言になる。
- 内部の生成・検証は[AIチャット入出力](../AIチャット入出力.md)を参照。GETの履歴取得は[イベントAPI](events.md)を参照。
- ローカルではD1のmigrationとイベントの準備に加えて、ルートの`.env`または`.dev.vars`に`GOOGLE_AI_API_TOKEN`を設定する。Cloudflare上はdevelop/mainごとに同名のSecretを登録する。`wrangler.jsonc`は必要なSecret名だけを宣言し、値を含めない。
- 通常テストは隔離したD1とLLMモックを使う。frontendのブラウザテストでも外部LLMは呼ばない。
