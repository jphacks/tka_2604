# backendの開発

- APIの入出力・エラーと完了条件を具体例にし、テスト → 実装 → 整理の順に進める。
- 処理の追加・変更には振る舞いを確認するテストを必ず追加・更新する。業務ロジックは単体テスト、APIはリクエスト単位、DB処理はテスト用D1との結合テストで確認する。
- テストは`test/`配下に`src/`と同じ相対ディレクトリ構成で置く（例：`src/db/events.ts` → `test/db/events.test.ts`）。共通のテスト補助処理は`test/helpers/`に置く。
- API変更時はOpenAPI定義・RPC型・実レスポンスの整合性も確認する。不正入力や権限エラーで保存処理が進まないことをテストする。
- APIの追加・変更・削除時は、手書きの`docs/api/openapi.json`も同じ変更で必ず更新する。契約テストは`test/helpers/openapi.ts`を使って追加する。仕様は自動更新されず、契約テスト対象外の更新漏れは`npm run check`で検出できないため、実装・仕様・テストを照合し、Swagger UIで表示とAPIの試行を確認する。詳細は[API手順](../../docs/api/README.md)を参照する。
- 技術・実装方針は[構成](../../docs/architecture.md)、確認方法は[テスト方針](../../docs/validation-ci.md)、DB変更は[DB方針](../../docs/database.md)に従う。
