# backendの開発

- APIの入出力・エラーと完了条件を具体例にし、テスト → 実装 → 整理の順に進める。
- 処理の追加・変更には振る舞いを確認するテストを必ず追加・更新する。業務ロジックは単体テスト、APIはリクエスト単位、DB処理はテスト用D1との結合テストで確認する。
- テストは`test/`配下に`src/`と同じ相対ディレクトリ構成で置く（例：`src/db/events.ts` → `test/db/events.test.ts`）。共通のテスト補助処理は`test/helpers/`に置く。
- API変更時はOpenAPI定義・RPC型・実レスポンスの整合性も確認する。不正入力や権限エラーで保存処理が進まないことをテストする。
- APIの追加・変更・削除時は、手書きの`apps/backend/docs/api/openapi.json`も同じ変更で必ず更新する。契約テストは`test/helpers/openapi.ts`を使って追加する。仕様は自動更新されず、契約テスト対象外の更新漏れは`npm run check`で検出できないため、実装・仕様・テストを照合し、Swagger UIで表示とAPIの試行を確認する。詳細は[API手順](docs/api/README.md)を参照する。
- 技術選定は[構成](../../docs/architecture.md)、確認方法は[テスト方針](../../docs/validation-ci.md)、DB変更は[DB方針](../../docs/database.md)に従う。

## backendの構造

`apps/backend/src`は `Route → Service → Repository` を基本とし、外部連携はServiceから`integrations/`を呼び出す。

```text
src/
├── index.ts             # アプリの組み立て・ルート登録
├── routes/              # HTTP入出力
├── services/            # 業務ロジック・処理の組み立て
│   └── events/
│       ├── service.ts
│       └── validation.ts
├── repositories/        # DBの取得・保存
├── db/                  # DB接続・Drizzleスキーマ
├── integrations/        # LLM・solverなどの外部連携
└── shared/
    ├── errors/          # 共通エラー
    └── utils/           # 業務に依存しない汎用処理
```

- Routeは入力検証、Serviceの呼び出し、HTTPレスポンス・エラーへの変換を担当する。HonoのハンドラーがControllerの役割を兼ね、Controllerは分けない。業務APIではRepositoryを直接呼ばない。
- Serviceは業務上の判定と処理の順序を担当する。長くなった判定・計算は`validation.ts`など機能内のファイルに切り出す。`domain/`は設けない。
- RepositoryはSQL、原子的な保存、更新競合の検出を担当する。HTTPには依存せず、DB接続とスキーマは`db/`に置く。
- Integrationsは外部通信、タイムアウト、外部レスポンスの変換を担当する。いつ呼ぶか・結果をどう扱うかはServiceで決め、通信はテストで差し替えられるようにする。
- 型・定数・補助処理は利用箇所の近くに置く。複数機能で使うものだけ`shared/`に置き、`shared/utils/`には業務ルールを入れない。
- 各層は機能名で整理し、必要になったフォルダーだけ作る。healthのように固定レスポンスを返すAPIはRouteだけで完結させる。

これは今後の実装・整理の方針。現在のhealthは`index.ts`、DBの取得・保存処理は`db/`にあり、既存処理の移動・分割時も振る舞いを維持する。テストは`test/`配下に`src/`と同じ相対ディレクトリ構成で置く。

## Solver連携

- Solver関連の実装・変更前に[BE - Solver API設計](<docs/BE - Solver API設計.md>)を読み、入出力・探索状態・エラーの契約に従う。Serviceでの呼び出し・結果処理と`integrations/`の通信実装も対象とする。
- 仕様書の未決定事項は対応Issueで確認し、独自に確定しない。制約JSONの正本は引き続き`apps/schema`とする。

## チャット・希望の制約化

- chat関連、フォームの希望からの制約化、履歴・由来・保存処理の変更前に[AIチャット設計](docs/AIチャット設計.md)を読む。
- 制約の正本は`apps/schema`。LLMの変換結果は共有形式と業務ルールで検証し、計算は明確な実行依頼時だけ行う。未決定の既定値を独自に追加しない。
