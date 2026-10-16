# 開発の入口

JPHACKS向けの出演順作成アプリ。ハッカソンのMVPとデモを優先し、必要な変更を小さく実装する。

- 技術選定は`docs/architecture.md`、共通の仕様・開発手順は`docs/`、backend固有の仕様は`apps/backend/docs/`に記載する。
- backendの作業前に[apps/backend/AGENTS.md](apps/backend/AGENTS.md)を読み、追加の開発・テストルールに従う。

- 仕様は[docs/product.md](docs/product.md)、全体構成は[docs/architecture.md](docs/architecture.md)、制約は[docs/schema.md](docs/schema.md)。backendの構成・責務は[apps/backend/AGENTS.md](apps/backend/AGENTS.md)に従う。議論はNotion、実装用の合意済み仕様はリポジトリで管理する。未決定事項を勝手に確定しない。
- 手順・命名・確認方法は[docs/development.md](docs/development.md)。ブランチは`feature/{issue番号}`、Issueなしなら`feature/内容`。commit・PRタイトルは`refs #{issue番号} 内容`、Issueなしは内容のみ。
- 環境構築・起動は[docs/setup.md](docs/setup.md)を参照する。
- 入力検証・commitフック・CIの範囲は[docs/validation-ci.md](docs/validation-ci.md)を参照する。
- Issueの完了条件を具体例・テストにしてから実装する。小さな資料変更には形式的なテストを増やさない。
- 制約の正本は`apps/schema`。生成物は手編集せず`npm run codegen`で更新する。LLMは制約化と説明、ソルバーは計算を担当する。ハード制約を勝手に緩めない。
- 関連テストと`npm run check`で確認する。Pythonテストは現在このチェックに含まれない。未確認・失敗は明示する。
- ユーザーの既存変更を保持し、今回の変更だけをcommitする。秘密情報をGitやログに残さない。マージ・本番デプロイ・本番DB変更は依頼がある場合に行う。
- IssueからPRまでの依頼は[develop-issue](.agents/develop-issue/SKILL.md)に従う。通常の実装判断は自律的に進め、結果を左右する仕様の不明点は確認する。
