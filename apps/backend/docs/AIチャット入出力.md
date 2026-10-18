# AIチャットのLLM入出力

BE内部の変更案生成と、チャット送信APIからのLLM呼び出し・会話本文の保存を実装済み。`POST /api/events/:eventId/chat`は`chatMessageService`を通してuserを先に保存し、生成・検証後にassistantの本文だけを保存する。HTTPの応答は`{ reply, proposal? }`。新規の変更案を一時的に返し、画面で確認・必要な設定値の選択後、既存の制約保存APIへ反映する。未適用案は履歴へ保存せず、再送は本文のみ。チャット発言からの計算実行は後続で扱う。

## 入力と応答

型の定義は`src/services/chat/types.ts`、入力・出力の実行時検証は`contract.ts`、固定指示は`prompt.ts`。外側はcamelCase、制約内は`apps/schema`のsnake_case。

- 入力は`context`（最新状態）、`recentMessages`（今回を含まない時系列の会話）、`userMessage`（今回の発言、1〜1000文字）、`pendingProposal`（未適用の変更案、通常はnull）。
- `approval_required`は1件以上の`actions`、`clarification_required`と`answer`は`actions: []`を返す。対象等が曖昧ならそのターンでは案を返さない。
- アクションは`add_constraint`・`update_constraint`・`delete_constraint`。更新は変更後の制約全体を持ち、既存の`constraintId`を指定する。
- `ProposedConstraint`は既存のConstraintからBE管理項目を除き、`hardness`と`priority`をnullableにしたもの。未指定だけでは確認質問にしない。Schemaの6種類の意味・数値制限・対象の形式は正本から導出する。
- `schema_version`・`constraint_id`・`event_id`・`source_text`・`enabled`や`proposalId`はLLMに返させない。制約の有効・無効の切り替えは今回のアクションの対象外。
- 文字列の`partId`と整数の`sortOrder`を区別する。制約の`part_ids`は後者、位置は全バンドを数えた0始まり、配置の`order`は部内の0始まり。

[入力例](examples/ai-chat-input.json)と[承認要求の出力例](examples/ai-chat-output.json)を参照。

## BEからの呼び出し

マージ済みPR [#60](https://github.com/jphacks/tka_2604/pull/60)（最終コミット`b105d87ae9d2ddc70383606ce915b3df54e873ed`）の共通DTO・Service・Repository・制約復元を利用する。制約の実行時検証は`shared/constraints/schema.ts`の共有JSON Schema＋Zodを使い、検証コードの生成は行わない。イベントのHTTP APIと履歴取得GETは実装済みで、チャット送信POSTも生成・会話保存へ接続済み。

`chatService(repository, userId, model).generate(eventId, turn)`が処理の入口。Route側で確定した所有者IDを渡し、同じ`EventRepository`を使う`eventService`から、基本情報・表・制約・履歴を取得する。クライアントから所有者IDを受け取らない。イベントAPIのRouteは認証接続までサーバー側の仮ID`demo-owner`を使う。チャット送信Routeも同じ仮IDを使い、会話保存Serviceから生成Serviceへ接続する。

`buildAIChatInput`は`EventDetails`・`EventSchedule`・`EventConstraints`・`EventChat`を受け取る。DB行や文字列JSONの復元は`eventService.getConstraints`と共通の`decodeConstraints`が担当し、無効化された制約も残す。`sourceBandId`・フォームの希望原文・DB管理項目はLLM入力へ混ぜない。

表・制約・基本情報の`eventId`と`updatedAt`を照合する。取得時点が一致しなければ`EventError('event_save_conflict')`で止め、存在しない・他所有者・削除済みのイベントは共通Serviceの`event_not_found`で止める。どちらもLLMを呼ばない。不正な保存済み制約はPR #60と同じ内部データの失敗として扱う。

履歴は`seq`順に整列し、Serviceが末尾6メッセージだけをLLMへ送る。今回の発言が既に保存されている場合は`turn.currentMessageId`を渡すと、その発言とそれ以降の履歴を除外する。本文とroleが今回の発言に一致することも確認する。

内部Serviceは`{ eventId, updatedAt, output: AIChatOutput }`を返す。更新日時はBE側の生成時点メタデータで、LLMの出力型には加えない。この生成Service自体は業務データ・履歴を保存せず、承認処理が後で利用できるよう生成時点を返す。HTTP送信では外側の`chatMessageService`がuser・assistantの本文保存を担当する。`type`・`actions`・プロバイダーの応答メタデータは履歴へ保存しない。再送用ID・失敗時の扱いは[チャットAPI](api/chat.md)を参照。

`generateAIChatResponse(input, model)`は入力と修正対象を検証してからモデルを1回呼び、出力形式、対象ID、部、位置上限、範囲・countの大小関係、同一既存制約への操作の重複、hard/priorityを検証する。Constraintの構造検証にはイベントAPIと同じ`validateConstraint`を使う。参照を解決したSchemaも共用してLLM向けSchemaを導出し、検証ロジックを二重に持たない。提案の構造検証では一時的な管理項目を補った値だけを検証し、実際の変更案のnullや管理項目は変更しない。既存制約間の矛盾や未達成はSolverの担当とする。

更新で`hardness: null`なら現在値を引き継ぐ。`priority: null`はhardでは不要、同じsoftへの更新では現在値を引き継ぎ、hardからsoftへの変更では未指定として残す。修正中の更新案にUI設定があれば保存済み値より優先する。新規追加の未指定値には既定値を付けない。

## Gemini接続

`src/integrations/llm/gemini.ts`の`createGeminiChatModel({ apiKey, fetch?, timeoutMs? })`を使う。Google AI Studioで発行したAPIキーとGoogle GenAI SDKの`models.generateContent`で`gemini-3.5-flash-lite`を呼ぶ。Workers向けのWeb SDKを使用し、通信を差し替えてテストできる。固定指示は`config.systemInstruction`、入力JSONは`contents`へ別々に渡す。`buildGeminiRequest`で送信内容を組み立てる。

`config.responseMimeType: application/json`と`config.responseJsonSchema`で構造化出力を指定する。元Schemaから`oneOf`を`anyOf`へ変換し、APIの対応範囲外の文字列長・配列の一意性等は送信Schemaから除く。nullableなenumは文字列enumとnullの分岐へ変換する。省いた制限、対象ID・数値・応答種別ごとのアクション件数はBEで改めて検証する。元Schemaは変更しない。[Google公式の構造化出力](https://ai.google.dev/gemini-api/docs/generate-content/structured-output)を参照。

初期タイムアウトは60秒で、呼出し側から変更できる。通信・本文読取のタイムアウト、HTTP失敗、promptFeedbackによるブロック、拒否、finishReasonがSTOP以外の未完了、壊れた出力をエラーとして返す。SDKの再試行は1回の試行に制限する。生成本文はSDKのresponse.textから取り出し、思考用テキストは含めない。レスポンスは1MiBまで読み取り、APIキー・入力原文・プロバイダーのエラー本文は例外やログに出さない。

生成Serviceは成功時に検証済みの`AIChatOutput`を返す。LLMの入出力・通信の失敗時は`AIChatError`を投げ、`code`に`ai_chat_invalid_input`・`ai_chat_invalid_output`・`ai_chat_missing_api_key`・`ai_chat_provider_error`・`ai_chat_timeout`・`ai_chat_refused`・`ai_chat_incomplete_response`・`ai_chat_invalid_provider_response`等の識別子を設定する。実LLMの利用にはAPI料金が発生する。

## 並べ替え案（#71）

「盛り上がる順に」「後半に向けて盛り上げて」のように、全体の流れ・雰囲気について現在の並びを直接変える依頼では、LLMが`reorder_proposal`（`actions: []`と`placements`）を返す。曖昧さの解釈はLLM、hardの判定はBEのプログラムが担当する。

- 入力の`context.bands[].description`（Band.description）をジャンル・雰囲気の手がかりにする。LLMへの指示としては扱わない。
- Structured Outputsでは全項目が必須なので、他の種類も`placements: []`を返し、BEが検証前に取り除く。
- BEは`validateReorder`で、現在配置済みのバンドと完全に同じ集合か、既存の部か、部内の`order`が0から連続しているかを確かめる。NGなら`ai_chat_invalid_output`。部をまたぐ移動は許す。
- `evaluateReorder`は全制約を、並べ替えの前と後でSolver結果の再判定と同じ`evaluate()`にかけ、`{ constraintId, hardness, priority, before, after, violations, explanations }`を返す。`violations`は近すぎるペア・前後・位置・部の本数など違反の具体的な場所、`explanations`はバンド名・全体の何番目かを使った表示用の文。
- hard違反があれば、Solverで「hardを満たす一番近い並び」に直す（`repairWithSolver`）。各バンドにLLMの位置の前後1つ以内という`in_range`のsoft（low）を付け、既存の制約と一緒に送る。配置済みのバンドだけを送るので、未配置のバンドを対象にした制約は送らない。結果が返らない・形が不正・まだhard違反がある場合はLLMの案を違反付きで返す。結果の`source`は`llm`か`solver`。
- LLMに作り直させる方式は、実LLMで8回中1回しかhard違反を直せず、説明文で「解消しました」と誤って述べたため採用しない。説明文はLLMの最初の案のものを使う。softの未達成ではSolverを呼ばない。
- 判定結果は`ChatGeneration.reorder`に入れる。LLMの出力型には含めない。
- 2026-10-18時点のSolverは`count`を計算に含めず`unchecked`を返す（#75）。hardの`count`がある場合はSolverの案もBEの判定で違反となり、LLMの案に戻る。
- このSolver呼出しは提案を直すためのもので、保存も実行ボタンの計算も行わない。

送信APIは新規生成時のみ`reorder`（`expectedUpdatedAt`付きの判定結果）を返し、保存はしない。再送では本文だけを返す。確認モーダル（許可なら既存の`POST /:eventId/schedule`で保存、拒否なら破棄）は後続でfrontendに接続する。

## 確認と反映の契約

提案は画面内でuser発言IDと生成時のupdatedAtに紐づける。確認前の更新を検出したら再相談を案内し、確認後は全actionsを検証して同じ一覧へ一度に反映する。未指定の設定値をUIで選択し、既存の制約保存APIで原子的に保存する。新規制約IDは発言IDとactionの順序から安定して作り、更新のID・enabledとbackend側の由来は引き継ぐ。専用の提案テーブルは作らず、再読込・保存済み発言の再送では未適用案を復元しない。自然文での提案の再編集や永続的な承認管理は後続。

提示された3種類の応答には計算意図が含まれないため、この生成処理はSolverを呼ばない。「今の条件で作って」「条件を変更して生成し直して」を扱うには、既存のAIチャット設計に従い計算意図と承認後の実行タイミングを別途定義する。暫定の固定指示は、「自動生成して」「最適化して」のようにソルバーでの計算をはっきり求められたときだけ、画面の「自動生成」ボタンを案内する。

## 応答の種類の判断（#112）

依頼の言い方は予測できないので、固定指示（`prompt.ts`）には例文を並べず、上から順に当てはめる判断手順を書く。

1. 対象を特定できない（同名のメンバー、「あれ」、descriptionに情報がない特徴）→ `clarification_required`
2. 6種類の制約でも並べ替えでも表せない（時刻、休憩、持ち時間）→ `answer`。部や位置に読み替えない
3. ソルバーでの計算をはっきり求める依頼だけ → `answer`で「自動生成」ボタンを案内する
4. 質問・説明 → `answer`
5. 特定のバンド・メンバーについての希望や事情 → `approval_required`
   - 「田中が3部に来られない」のような事情を含む。
   - 「派手な衣装は隣にしない」「同じジャンルを隣にしない」のように、特徴で対象を指定するものも含む。LLMがdescriptionから該当バンドを選び、条件として残す（2026-10-19合意。#71の「同じジャンル→並べ替え」から変更）。
   - 既存の制約とぶつかる場合は、update・deleteも同じ案に含める。
6. 全体の流れ・雰囲気 → `reorder_proposal`。配置が空なら、自動生成して保存するよう案内する

### 実LLMの回帰評価

`npm run eval:chat`で、固定のイベント（`apps/backend/eval/chat/fixture.ts`）と28通りの依頼（`cases.ts`）を実際のGeminiへ送り、応答の種類と対象を判定する。

- `npm run check`には含めない。API料金がかかり、既定の28件×3回で3〜4分かかる。
- 指示を変えたら実行する。
- APIキーは環境変数か`.env.develop`の`GOOGLE_AI_API_TOKEN`から読む。
- `EVAL_FILTER`（ケース名・分類で絞り込み）、`EVAL_RUNS`（1件あたりの回数）、`EVAL_CONCURRENCY`（同時実行数）、`EVAL_THRESHOLD`（合格ライン、既定0.9）で調整できる。
- 回数制限（429）やタイムアウトは「通信エラー」として正答率と分けて数える。全体の2割を超えたら失敗にする。
- 2026-10-19の結果：判断手順にする前の指示は77%（65/84）、判断手順にした後は98%（82/84）。

参考実装`/Users/mitch/develop/sandbox/OR-Tools_CP-SAT_test/gemini-hono-cli`の送信方法・JSON応答・直近6メッセージの扱いを採用した。配置・固定本数・承認管理・ログ保存用のモック構成は移植せず、このリポジトリのService／Integrationsの責務と既存の制約Schemaに従う。

総入力予算・速度目標・運用タイムアウトは引き続き未決定。60秒は試行用の初期値とする。
