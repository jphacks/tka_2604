# 認証API

## 概要

ブラウザ → backendのアカウント登録・ログイン・セッション確認・ログアウトを実装済み。ユーザーIDとパスワードで認証し、D1で管理する24時間のCookieセッションを使う。メールアドレスは使用しない。

登録したユーザーの`users.password_hash`にはランダムなsalt付きscryptハッシュを保存する。セッションは256bitのランダムなトークンをCookieにだけ返し、D1の`auth_sessions`にはそのSHA-256ハッシュと所有ユーザー・有効期限だけを保存する。パスワードやトークンをAPIのJSON応答・ログへ出力しない。

scryptは`N=16384, r=8, p=5`、salt 16 byte、出力32 byteを使う。[OWASPのscrypt設定例](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html#scrypt)を基にし、保存値から任意の計算コストを受け付けない。Workersのネイティブ実装を使用し、実行環境の条件は[環境構築](../../../../docs/setup.md#アカウントと既存データの準備59)を参照する。

## API仕様

| メソッド | エンドポイント       | 用途                         | 成功時 |
| -------- | -------------------- | ---------------------------- | ------ |
| POST     | `/api/auth/register` | 登録してログイン             | 201    |
| POST     | `/api/auth/login`    | 既存アカウントでログイン     | 200    |
| GET      | `/api/auth/session`  | セッションのユーザーIDを取得 | 200    |
| POST     | `/api/auth/logout`   | セッションを無効化           | 204    |

- HTTPSが必須。ローカル開発だけは`localhost`・`127.0.0.1`・`[::1]`のHTTPを許可する。
- HTTPSのCookieは`__Host-setly_session`。`HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=86400`を設定し、Domainは指定しない。ローカルHTTPでは`setly_session`を使い、Secureだけ省略する。
- セッションは発行から24時間で失効し、アクセスでは延長しない。登録・ログインの成功時には新しいトークンを発行し、リクエストCookieにある既存セッションを無効化する。ログアウトではDBのセッションを削除しCookieを消去する。
- POSTにはリクエストURLと完全一致するオリジンの`Origin`ヘッダーが必須。`Sec-Fetch-Site`がある場合は`same-origin`または`none`だけを受け付ける。ブラウザは自動送信する。CLIからの試行でもOriginを指定する。
- `/api`の応答は`Cache-Control: no-store`。認証APIの本文は4KiBまで。
- 登録・ログインは別々のカウンターで、固定60秒窓に「ユーザーID＋送信元IP」あたり各10回まで。別IPの試行や登録の試行で、本人のログイン枠を消費しない。送信元IP全体では登録・ログイン合算で30回まで。成功・失敗を問わず数え、上限時は429と`Retry-After`秒数を返す。拒否のたびに期限を延長しない。D1には制限キーのハッシュを保存する。

管理用API・Swagger UI・OpenAPI JSONは有効なセッションが必要。イベントの所有者はセッションから決め、別ユーザーのイベントは404にする。管理用POST/PATCH/DELETEでも同じ送信元検証を行う。認証失敗は401で、業務データの保存やLLM・Solverの呼び出しを行わない。

認証なしで使える業務APIは`GET /api/health`と[公開フォーム](forms.md)の既存3操作だけ。フォームURLによるアクセスから管理用APIの権限は得られない。

## リクエスト

### アカウント登録

```http
POST /api/auth/register
Content-Type: application/json
Origin: http://localhost:8787
```

```json
{ "userId": "live-organizer", "password": "example-only-long-passphrase" }
```

ユーザーIDは3〜20文字の半角英数字・`_`・`-`。大小文字は区別する。`demo-owner`は既存のデモデータ保護のため予約済み。パスワードは7〜32文字で、空白のみは拒否する。前後の空白は削らず、そのまま扱う。余分な項目は拒否する。

### ログイン

```http
POST /api/auth/login
Content-Type: application/json
Origin: http://localhost:8787
```

```json
{ "userId": "live-organizer", "password": "example-only-long-passphrase" }
```

既存アカウントとの互換性のため、ログイン時のユーザーID・パスワードはいずれも1〜128文字。新規登録の短いID上限やパスワード最小長は既存ログインに適用しない。余分な項目は拒否する。ユーザーが存在しない場合とパスワードが違う場合は同じ401応答にする。

### セッション確認

`GET /api/auth/session`。ボディなし。ブラウザが同一オリジンのCookieを送る。

### ログアウト

`POST /api/auth/logout`。ボディなし。同一オリジンのOriginを付ける。未認証・失効済みでも204になる。

## レスポンス

登録成功は201、ログイン・セッション確認の成功は200。JSONはユーザーIDだけを返す。登録・ログインの成功には`Set-Cookie`が付く。

```json
{ "userId": "live-organizer" }
```

ログアウトの成功は204で本文なし。削除済みトークンを再送しても認証には使えない。

| HTTP | error.code          | 意味                                                     |
| ---- | ------------------- | -------------------------------------------------------- |
| 400  | invalid_input       | JSON構文不正                                             |
| 401  | invalid_credentials | ログインIDまたはパスワードが不正                         |
| 401  | unauthorized        | セッションなし・無効・期限切れ                           |
| 403  | invalid_origin      | Origin欠落・不一致、異なる送信元、許可していないHTTP環境 |
| 409  | user_id_unavailable | 登録IDが使用済み、または予約済み                         |
| 413  | invalid_input       | 認証リクエスト本文が4KiB超                               |
| 422  | invalid_input       | 型・長さ・文字種・余分な項目が不正                       |
| 429  | rate_limited        | 登録・ログインの試行上限に到達                           |
| 500  | internal_error      | 認証処理の内部エラー                                     |

```json
{
  "error": {
    "code": "unauthorized",
    "message": "ログインしてください。",
    "details": []
  }
}
```

DBの例外・保存済みハッシュなどの内部情報は返さない。各操作の適用ステータスは[OpenAPI](openapi.json)を参照。

## 懸念点・未決定事項

パスワード再設定・メール確認・多要素認証は今回の対象外。ユーザー追加は登録画面から行う。旧seedの`demo-owner`にはログイン可能な共通パスワードを設けず、既存イベントの移管も自動では行わない。

D1を使う試行制限は認証APIの最低限の防御であり、全APIのアクセス制限や大量アクセス対策は別途検討する。ログイン妨害を防ぐためID単独の全IP共通ロックは設けず、分散IPによる試行への対策は別途必要。リモートDBへのmigration適用・本番デプロイは依頼がある場合に行う。

## プロフィール

`GET /api/auth/profile` と `PATCH /api/auth/profile` は有効なセッションが必要。PATCHは他の管理APIと同じOrigin検証と4KiBの入力制限を行う。対象ユーザーはセッションから決め、ログインID・パスワード・イベント所有者は変更しない。

```json
{ "displayName": "ライブ運営" }
```

GET・更新成功は200で表示名のみを返す。PATCHは前後空白除去後1〜40文字のdisplayNameが必須、未定義項目は422。未設定ならログインIDを表示名に使う。変更はD1の同じユーザーへ保存し、別端末でも次の取得時に反映する。同時編集は最後の保存を採用する。アイコンはfrontendで表示名の先頭文字から自動表示し、小文字は大文字にする。アイコン文字・色の設定や画像アップロードは持たない。

`0009_account_profile.sql`で表示設定を追加し、`0010_remove_custom_avatar.sql`で不要となったアイコン設定2列を削除する。表示名・認証情報・セッション・イベントは保持する。
