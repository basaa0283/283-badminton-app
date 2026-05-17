# テスト方針

## 使用ツール

- **テストランナー**: [Vitest](https://vitest.dev/)
- **カバレッジ**: `@vitest/coverage-v8`

選定理由：Next.js 16 / React 19 / ESM 環境にネイティブ対応しており、TypeScript の追加設定なしで動作するため。

## ディレクトリ構成

テストファイルは対象モジュールと同じ階層に配置する（コロケーション方式）。

```
src/
├── lib/
│   ├── validations.ts
│   ├── validations.test.ts   ← 同階層
│   ├── line-messaging.ts
│   └── line-messaging.test.ts
└── ...
```

ファイル命名規則：

- `*.test.ts` または `*.test.tsx` （単体テスト）
- `*.spec.ts` または `*.spec.tsx` （仕様ベースのテスト）

## 実行コマンド

```bash
npm test              # 全テストを1回実行
npm run test:watch    # ウォッチモード（開発中）
npm run test:coverage # カバレッジレポート付き
```

カバレッジレポートは `coverage/index.html` をブラウザで開いて確認。

## CI

`.github/workflows/test.yml` で `dev/release` および `master` への push / PR 時に自動実行。テストが落ちると PR マージがブロックされる（GitHub の Branch Protection と組み合わせる場合）。

## どこから書くか（優先順位）

1. **純粋関数 / 値のバリデーション**
   - 例: `src/lib/validations.ts` (Zod スキーマ)
   - 依存関係が少なくサクッと書ける、回帰防止効果が高い
2. **ビジネスロジックを持つユーティリティ**
   - 例: `src/lib/line-messaging.ts`
   - 外部APIは fetch モックで対応
3. **API Route ハンドラ**
   - Prisma を `vi.mock()` でモック
4. **React コンポーネント**
   - `@testing-library/react` を別途導入してから

## テストの書き方ガイド

### 基本

```typescript
import { describe, it, expect } from "vitest";

describe("対象の名前", () => {
  it("○○の場合は△△になる", () => {
    expect(actual).toBe(expected);
  });
});
```

### 共通パターン

- **Zodスキーマ**: `schema.safeParse(input)` の `success` を確認
- **`it.each`**: 同じ振る舞いの値違いをまとめて検証
- **境界値テスト**: 0, 1, 上限, 上限+1 を必ず確認

### モック

```typescript
import { vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));
```

## E2E テスト (Playwright)

### 概要

- **対象**: ブラウザ操作レベルのリグレッション (login, event操作 等)
- **実行タイミング (CI)**: `dev/release` への push および `master` 向け PR
- **DB**: DEV 環境の Azure SQL Database を共用 (並行実行不可、 `concurrency.group` で逐次化)
- **ログイン**: `dev-login` プロバイダ (NODE_ENV=development 限定)

### ディレクトリ

```
e2e/
└── smoke.spec.ts     ← 最小スモークテスト
playwright.config.ts  ← 設定
.github/workflows/e2e.yml  ← CI ワークフロー
```

### ローカル実行

```bash
# 環境変数 (例)
export DATABASE_URL="..."          # DEV の SQL Server 接続文字列 / もしくはローカル SQLite
export NEXTAUTH_SECRET="..."
export E2E_ADMIN_USER_ID="..."     # dev-login で使う管理者ユーザーID

npm run test:e2e         # ヘッドレス実行
npm run test:e2e:ui      # Playwright UIモードでデバッグ
```

`E2E_ADMIN_USER_ID` が未設定の場合、dev-login を要するテストはスキップされる。

### CI で必要な GitHub Secrets

| Secret | 用途 |
|---|---|
| `DATABASE_URL` | DEV の Azure SQL Database 接続文字列 (deploy-dev.yml と共用) |
| `NEXTAUTH_SECRET` | NextAuth セッション署名鍵 (DEV と同じもの) |
| `E2E_ADMIN_USER_ID` | dev-login テストで使う管理者の DB ID |

### テストの追加方針

- DB変更を伴うテストは末尾でクリーンアップする
- テストデータには `e2e-` のような識別可能なプレフィックスを付ける
- LINE OAuth 経路は E2E では検証しない (手動 [`RELEASE_VERIFICATION.md`](./RELEASE_VERIFICATION.md))

## 今後の課題

- API Route のテストパターン整備（モック戦略）
- React Testing Library 導入とコンポーネントテスト
- E2E テストのシナリオ拡充 (#9)
- カバレッジ閾値の設定（`vitest.config.ts` の `coverage.thresholds`）
