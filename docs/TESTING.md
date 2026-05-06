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

## 今後の課題

- API Route のテストパターン整備（モック戦略）
- React Testing Library 導入とコンポーネントテスト
- E2E テスト（Playwright）の導入検討
- カバレッジ閾値の設定（`vitest.config.ts` の `coverage.thresholds`）
