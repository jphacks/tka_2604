# Setly

[![IMAGE ALT TEXT HERE](https://jphacks.com/wp-content/uploads/2026/07/IMG_5316.png)](https://www.youtube.com/watch?v=piaNsc6ilBI)

## 開発用リンク

- [develop環境のAPIドキュメント（Swagger UI）](https://dev.jphack-2026.workers.dev/api/docs)：API仕様の閲覧と`Try it out`による動作確認。
- [APIドキュメントの更新・公開手順](apps/backend/docs/api/README.md)

## 製品概要

### 背景(製品開発のきっかけ、課題等）

### 製品説明（具体的な製品の説明）

### 特長

#### 1. 特長1

#### 2. 特長2

#### 3. 特長3

### 解決出来ること

### 今後の展望

### 注力したこと（こだわり等）

-
-

## 開発技術

### 活用した技術

#### API・データ

- **Gemini API（Google AI Studio）**：自然言語で入力された要望を解釈し、出演順の条件の追加・変更を提案。
- **Cloudflare D1**：イベント、バンド、出演者、所属関係、制約、出演順、チャット履歴を保存。
- **Cloudflare Workers / Vercel**：Webアプリ・業務APIと、Pythonによる出演順の計算APIをそれぞれ実行。

#### フレームワーク・ライブラリ・モジュール

- **React / TypeScript / Vite**：フロントエンドの開発。
- **Tailwind CSS / dnd-kit**：画面のスタイリングと、ドラッグ＆ドロップによる出演順の編集。
- **Hono / Hono RPC**：業務APIの実装と、フロントエンド・バックエンド間の型共有。
- **FastAPI / Pydantic**：Pythonの計算APIと入力データの検証。
- **Google OR-Tools CP-SAT**：出演間隔、前後関係、位置固定などの条件を考慮した出演順の探索。
- **Drizzle ORM / Zod / JSON Schema**：DB操作、入力検証、TypeScriptとPythonで共有する制約形式の定義。
- **Vitest / Testing Library / Playwright / pytest**：単体テスト、API・DBの結合テスト、ブラウザ操作のテスト。

#### デバイス

- PC・スマートフォンのWebブラウザ。専用デバイスは不要。

### 独自技術

#### ハッカソンで開発した独自機能・技術

- 
