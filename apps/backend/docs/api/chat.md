# チャット送信 API定義書

## 概要

ユーザー発言をD1へ保存してからGeminiを呼び、検証済み応答の`message`本文をassistant発言として保存する。保存完了後、frontendへ返信する。既存の`chat_messages`を使い、追加のテーブル・migrationはない。

## API仕様

| 項目                   | 内容                                                                                  |
| ---------------------- | ------------------------------------------------------------------------------------- |
| エンドポイント         | `/api/events/:eventId/chat`                                                           |
| HTTPメソッド           | POST                                                                                  |
| 呼出し元 → 呼出し先    | frontendのチャット → Hono backend → Gemini                                            |
| リクエスト・レスポンス | application/json                                                                      |
| 認証                   | [Cookieセッション](auth.md)が必要。ログイン中のユーザーが所有する有効なイベントに限定 |

## リクエスト

有効なセッションCookieと同一オリジンの`Origin`が必要。認証・送信元の検証に失敗した場合は保存や外部通信を行わない。

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
5. 保存したassistant本文を返す。自分の回答INSERTに成功した新規の制約変更案に限り、検証済みの未適用案も返す。並行再送で先に保存された他の回答を返す場合は案を付けない。

採番はINSERT内で原子的に行い、同じuserへのassistant回答は一意とする。並行再送でLLMが複数回呼ばれることはあるが、DBの回答は1件で、先に保存された回答を返す。会話の保存でイベントの`updatedAt`は更新しない。

## レスポンス

200（回答保存済み、または同じ発言の保存済み回答）：

```json
{ "reply": "必要な出演間隔を教えてください。" }
```

新規生成で制約変更案がある場合は `proposal: { expectedUpdatedAt, actions }` を追加する。actionsは `add_constraint / update_constraint / delete_constraint` で、追加・更新のconstraintは共有形式からID・schema_version・enabled・source_textを除いた形。hardnessとpriorityは未指定ならnull。対象・paramsは共有Schemaとイベント所属で検証済み。frontendは内容と必須／任意・必要な優先度を確認し、完成した同じ制約一覧を既存のPOST `/constraints` で自動保存する。この送信API自体では制約や配置を更新せず、Solverも実行しない。

未適用案は会話履歴や専用テーブルに保存しない。再読込・保存済み発言の再送では本文だけが返り、案を復元・再適用しない。必要なら新しい発言で再度相談する。確認前にイベントの更新日時が変わった案は反映せず、再相談を案内する。

入力検証後に確定した発言IDを`X-Chat-Message-Id`レスポンスヘッダーへ返す。LLM失敗後もこのIDを再送に使う。入力検証前の400・422では発言IDは確定せず、保存も行わない。

PR #60のイベントAPIと同じ`{ error: { code, message, details } }`でエラーを返す。

| HTTP | code                  | 内容                                                         |
| ---- | --------------------- | ------------------------------------------------------------ |
| 400  | invalid_input         | 壊れたJSON                                                   |
| 422  | invalid_input         | 本文・発言IDの欠落や型・長さ・定義外項目などの不正入力       |
| 401  | unauthorized          | 未認証・無効または期限切れのセッション                       |
| 403  | invalid_origin        | 送信元不正・Origin欠落                                       |
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

- 履歴には本文だけを使い、新規応答に限って変更案を一時的に返す。提案の自然文での再編集と、チャット発言によるSolver実行は後続。未確認のactionsを完成済み制約として保存しない。
- frontendのAPIモードはDBの名簿と履歴を取得し、送信に`messageId`を指定する。返信後は履歴を再取得し、失敗後・再読込後の未回答発言も同じID・本文で再試行できる。未保存の出演順は右上の保存ボタンから保存し、制約の自動保存完了後に送信する。IDを省略した送信では、本文が同じでも新しい発言になる。
- 内部の生成・検証は[AIチャット入出力](../AIチャット入出力.md)を参照。GETの履歴取得は[イベントAPI](events.md)を参照。
- ローカルではD1のmigrationとイベントの準備に加えて、ルートの`.env`または`.dev.vars`に`GOOGLE_AI_API_TOKEN`を設定する。Cloudflare上はdevelop/mainごとに同名のSecretを登録する。`wrangler.jsonc`は必要なSecret名だけを宣言し、値を含めない。
- 通常テストは隔離したD1とLLMモックを使う。frontendのブラウザテストでも外部LLMは呼ばない。
