# Points Infrastructure (P1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ポイント制度の基盤 (スキーマ + addPoints ヘルパー + 既存 priorityScore からの値転記 + 新規ログイン時 signup.bonus +10 pt) を実装する。UI 変更とキャンセル抑制ロジックは P2 以降。

**Architecture:** User に `lifetimePoints` (累積、減らない) と `availablePoints` (有効、減算可) の 2 フィールドを追加。すべての増減は `PointTransaction` に履歴を残す。既存の `priorityScore` カラムは互換性のため残し、初回マイグレーションで値を `availablePoints` に転記する。新規ログイン時 (NextAuth `events.signIn`) に「signup.bonus が未付与なら +10 pt」処理を入れる。

**Tech Stack:** Next.js 16 App Router / Prisma 5 / vitest / Azure SQL (PROD) / SQLite (local)

**Spec:** `docs/superpowers/specs/2026-06-11-points-achievements-cancel-design.md`

---

## File Structure

- **Modify**: `prisma/schema.prisma` — User の 2 フィールド、`PointTransaction`、`AchievementUnlock`、`AttendanceHistory.cancelType`、`Event.attendanceBonusPoints` を追加
- **Modify**: `prisma/schema.sqlserver.prisma` — 同上 (Azure SQL 用に型修飾付き)
- **Create**: `src/lib/points.ts` — `addPoints` ヘルパー (delta>0 で両方加算 / delta<0 で available のみ減算、0 下限 / delta=0 でスキップ / 必ず PointTransaction 作成)
- **Create**: `src/lib/points.test.ts` — `addPoints` の単体テスト (vitest + prisma の Mock または in-memory)
- **Create**: `scripts/migrate-priority-to-available.ts` — `User.priorityScore > 0` を `availablePoints` に転記 (idempotent: 既に availablePoints が priorityScore 以上のユーザーは触らない)
- **Modify**: `src/lib/auth.ts` — `events.signIn` で「PointTransaction.signup.bonus が無いなら +10 pt」を追加

---

## Task 1: Prisma schema 拡張

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `prisma/schema.sqlserver.prisma`

- [ ] **Step 1: `schema.prisma` の User モデルに 2 フィールド追加**

`prisma/schema.prisma` の `tournamentResultsPublic Boolean @default(false)` の直後に追加:

```prisma
  // ポイント制度 (P1)
  // lifetimePoints: 累積、減らない (経験値・ランキング用)
  // availablePoints: 有効、ペナルティで減る (キャンセル待ち優先度に直結予定)
  lifetimePoints  Int @default(0)
  availablePoints Int @default(10)
```

- [ ] **Step 2: `schema.prisma` に PointTransaction / AchievementUnlock を追加**

`User` モデルの relations セクション (`activityLogs ActivityLog[]` の直後) に以下を追加:

```prisma
  pointTransactions  PointTransaction[]
  achievementUnlocks AchievementUnlock[]
```

`User` モデルの閉じカッコ `}` の直後に新規モデルを追加:

```prisma
// ポイント増減の履歴。設計 docs/superpowers/specs/2026-06-11-points-achievements-cancel-design.md 参照。
// reason 命名: "signup.bonus" / "event.attendance" / "cancel.same_day_with_notice" など
model PointTransaction {
  id         String   @id @default(cuid())
  userId     String
  delta      Int      // 正=加算、負=減算。0 はレコードを作らない
  reason     String
  entityType String?
  entityId   String?
  createdAt  DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, createdAt])
  @@index([reason])
}

// 実績バッジ解除レコード。achievementId は src/lib/achievements.ts の定数 ID。
model AchievementUnlock {
  userId        String
  achievementId String
  unlockedAt    DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@id([userId, achievementId])
  @@index([achievementId])
}
```

- [ ] **Step 3: `schema.prisma` の AttendanceHistory に cancelType 追加**

`AttendanceHistory` モデルの中で、適切な位置 (createdAt の前) に追加:

```prisma
  // キャンセルの質 (P1)
  // "regular" | "same_day_with_notice" | "same_day_no_notice" | "no_show"
  cancelType String?
```

- [ ] **Step 4: `schema.prisma` の Event に attendanceBonusPoints 追加**

`Event` モデルの `actualRevenue Int?` の直後に追加:

```prisma
  // ポイント制度: イベント参加完了時の追加ボーナス pt (null/0 = 基本値のみ)
  attendanceBonusPoints Int?
```

- [ ] **Step 5: `schema.sqlserver.prisma` に同等の変更を適用**

`prisma/schema.sqlserver.prisma` も全く同じ箇所に同じフィールドを追加する。SQL Server 固有:
- 文字列フィールドは可能なら `@db.NVarChar(N)` を付ける:
  - `PointTransaction.reason` → `@db.NVarChar(100)`
  - `PointTransaction.entityType` → `@db.NVarChar(50)`
  - `AchievementUnlock.achievementId` → `@db.NVarChar(100)`
  - `AttendanceHistory.cancelType` → `@db.NVarChar(50)`
- リレーションの `onDelete: Cascade` は Azure SQL Server では循環 cascade に注意。`User` ↔ `PointTransaction` / `User` ↔ `AchievementUnlock` は単方向 cascade なので OK だが、念のため `onDelete: NoAction, onUpdate: NoAction` を試して問題があれば Cascade に変える。

参考: 既存の `EventCategory` 等は `onDelete: NoAction, onUpdate: NoAction` パターン。

- [ ] **Step 6: Prisma client 再生成 + ローカル DB に適用**

```bash
npx prisma generate
npx prisma db push --skip-generate --accept-data-loss
```

Expected: `🚀  Your database is now in sync with your Prisma schema.` 表示。

- [ ] **Step 7: tsc で型チェック**

```bash
npx tsc --noEmit
```

Expected: 出力なし (= 型エラーなし)。

---

## Task 2: `addPoints` のテストを書く (失敗確認)

**Files:**
- Create: `src/lib/points.test.ts`

- [ ] **Step 1: テストファイル作成**

`src/lib/points.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from "vitest";

// addPoints は prisma を直接触る。
// Test では prisma を mock 化して、呼び出しの引数と更新値を検証する。
vi.mock("./prisma", () => ({
  prisma: {
    user: {
      update: vi.fn(),
      findUnique: vi.fn(),
    },
    pointTransaction: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

import { addPoints } from "./points";
import { prisma } from "./prisma";

describe("addPoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // $transaction は配列を受け取り、そのまま実行する形にする
    (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
      async (ops: unknown[]) => ops,
    );
  });

  it("delta > 0 で lifetime と available の両方に加算 + PointTransaction を作成", async () => {
    (prisma.user.update as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (prisma.pointTransaction.create as ReturnType<typeof vi.fn>).mockResolvedValue({});

    await addPoints("user-1", 5, "event.attendance", { type: "Event", id: "evt-1" });

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { lifetimePoints: { increment: 5 }, availablePoints: { increment: 5 } },
    });
    expect(prisma.pointTransaction.create).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        delta: 5,
        reason: "event.attendance",
        entityType: "Event",
        entityId: "evt-1",
      },
    });
  });

  it("delta < 0 で available のみ減算 (lifetime は変えない) + PointTransaction を作成", async () => {
    (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      availablePoints: 10,
    });

    await addPoints("user-2", -3, "cancel.same_day_with_notice");

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-2" },
      data: { availablePoints: 7 },
    });
    expect(prisma.pointTransaction.create).toHaveBeenCalledWith({
      data: {
        userId: "user-2",
        delta: -3,
        reason: "cancel.same_day_with_notice",
        entityType: undefined,
        entityId: undefined,
      },
    });
  });

  it("delta < 0 で available が 0 を下回らない (clamp to 0)", async () => {
    (prisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      availablePoints: 2,
    });

    await addPoints("user-3", -5, "cancel.no_show");

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-3" },
      data: { availablePoints: 0 },
    });
    // PointTransaction には実際に減算した値 (-2) ではなく、reason に従った値 (-5) を残すか、
    // 実際に減らした値を残すか — 仕様: 実際に減らした値 (= -2) を残す。
    expect(prisma.pointTransaction.create).toHaveBeenCalledWith({
      data: {
        userId: "user-3",
        delta: -2,
        reason: "cancel.no_show",
        entityType: undefined,
        entityId: undefined,
      },
    });
  });

  it("delta = 0 のときはレコードを作らずスキップ", async () => {
    await addPoints("user-4", 0, "cancel.regular");

    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(prisma.pointTransaction.create).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: テスト実行して失敗を確認**

```bash
npm test -- src/lib/points.test.ts
```

Expected: テスト失敗 (`Cannot find module './points'` or similar)。

---

## Task 3: `addPoints` を実装

**Files:**
- Create: `src/lib/points.ts`

- [ ] **Step 1: 実装ファイル作成**

`src/lib/points.ts`:

```ts
import { prisma } from "./prisma";

// ポイント増減の共通ヘルパー。設計 docs/superpowers/specs/2026-06-11-points-achievements-cancel-design.md 参照。
// - delta > 0: lifetimePoints と availablePoints の両方に増分加算。
// - delta < 0: availablePoints のみ減算 (0 下限)。実際に減らした絶対値を PointTransaction.delta に記録する。
// - delta = 0: 何もしない (レコードも作らない)。
// reason は "domain.event" 命名。entity は紐付き対象がある場合のみ渡す。
export async function addPoints(
  userId: string,
  delta: number,
  reason: string,
  entity?: { type: string; id: string },
): Promise<void> {
  if (delta === 0) return;

  if (delta > 0) {
    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: {
          lifetimePoints: { increment: delta },
          availablePoints: { increment: delta },
        },
      }),
      prisma.pointTransaction.create({
        data: {
          userId,
          delta,
          reason,
          entityType: entity?.type,
          entityId: entity?.id,
        },
      }),
    ]);
    return;
  }

  // delta < 0: 0 下限で減らす
  const current = await prisma.user.findUnique({
    where: { id: userId },
    select: { availablePoints: true },
  });
  const have = current?.availablePoints ?? 0;
  const actualDelta = Math.max(delta, -have); // -have より小さくならない (= 0 下限)
  if (actualDelta === 0) {
    // 既に 0 で何も減らせないが、ログだけは残しても残さなくても良い。
    // ここでは「実質的な変化なし」としてスキップ。
    return;
  }
  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { availablePoints: have + actualDelta },
    }),
    prisma.pointTransaction.create({
      data: {
        userId,
        delta: actualDelta,
        reason,
        entityType: entity?.type,
        entityId: entity?.id,
      },
    }),
  ]);
}
```

- [ ] **Step 2: テスト実行して全パスを確認**

```bash
npm test -- src/lib/points.test.ts
```

Expected: 4 tests passed。

- [ ] **Step 3: 全テスト + lint + tsc**

```bash
npm test 2>&1 | tail -5
npm run lint 2>&1 | grep -E "error|✖" | tail -3
npx tsc --noEmit
```

Expected: テスト全 PASS、lint 0 errors、tsc 出力なし。

---

## Task 4: priorityScore → availablePoints マイグレーションスクリプト

**Files:**
- Create: `scripts/migrate-priority-to-available.ts`

- [ ] **Step 1: スクリプト作成**

`scripts/migrate-priority-to-available.ts`:

```ts
import { PrismaClient } from "@prisma/client";

// 1 回限りの初期マイグレーション:
// 既存の User.priorityScore > 0 を availablePoints に転記する。
// idempotent: availablePoints が既に priorityScore 以上なら触らない (二重実行でも問題なし)。
// PointTransaction `priority.migrate` を残して履歴を追跡可能にする。
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      nickname: true,
      priorityScore: true,
      availablePoints: true,
    },
  });

  let updated = 0;
  for (const u of users) {
    if (u.priorityScore <= 0) continue; // 0 以下は無視
    if (u.availablePoints >= u.priorityScore) continue; // 既に同等以上ならスキップ

    const delta = u.priorityScore - u.availablePoints;
    await prisma.$transaction([
      prisma.user.update({
        where: { id: u.id },
        data: {
          lifetimePoints: { increment: delta },
          availablePoints: { increment: delta },
        },
      }),
      prisma.pointTransaction.create({
        data: {
          userId: u.id,
          delta,
          reason: "priority.migrate",
          entityType: "User",
          entityId: u.id,
        },
      }),
    ]);
    updated += 1;
    console.log(`  - ${u.nickname} (${u.id}): +${delta} pt`);
  }

  console.log(`\nDone. ${updated} / ${users.length} users updated.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

- [ ] **Step 2: ローカルで一度実行 (テストデータがあれば動作確認)**

```bash
npx tsx scripts/migrate-priority-to-available.ts
```

Expected: `Done. N / M users updated.` 表示。エラーなし。

- [ ] **Step 3: idempotent 確認のため再実行**

```bash
npx tsx scripts/migrate-priority-to-available.ts
```

Expected: `Done. 0 / M users updated.` (= 2 回目は何も更新されない)。

---

## Task 5: 新規ログイン時 signup.bonus +10 pt

**Files:**
- Modify: `src/lib/auth.ts`

- [ ] **Step 1: events.signIn 内で signup.bonus 加算ロジックを追加**

`src/lib/auth.ts` の `void logActivity({ ... action: "auth.login" ... });` の直後に以下を追加:

```ts
        // signup.bonus: 全ユーザーが 1 回だけ +10 pt をもらえる
        // (PointTransaction.reason = "signup.bonus" が既にあればスキップ)
        try {
          const existing = await prisma.pointTransaction.findFirst({
            where: { userId: dbUser.id, reason: "signup.bonus" },
            select: { id: true },
          });
          if (!existing) {
            const { addPoints } = await import("./points");
            await addPoints(dbUser.id, 10, "signup.bonus", {
              type: "User",
              id: dbUser.id,
            });
          }
        } catch (err) {
          // ボーナス失敗でログインを止めない
          console.error("[events.signIn] signup.bonus failed:", err);
        }
```

> 注: dynamic import (`await import("./points")`) を使うのは、`auth.ts` のトップで `points.ts` を import すると依存関係が複雑になるため (`prisma.ts` 経由の循環参照を避ける目的)。

- [ ] **Step 2: lint / tsc**

```bash
npm run lint 2>&1 | grep -E "error|✖" | tail -3
npx tsc --noEmit
```

Expected: lint 0 errors、tsc 出力なし。

- [ ] **Step 3: 全テスト実行**

```bash
npm test 2>&1 | tail -5
```

Expected: 全 PASS。

---

## Task 6: 最終動作確認 (オプション、手動)

**Files:**
- なし (ローカル DB 操作のみ)

- [ ] **Step 1: ローカル dev サーバー起動して LINE ログインを試す**

```bash
npm run dev
```

ブラウザで `/login` → LINE 認証 → ホームへ。
`scripts/check-points.ts` 的な確認スクリプトがなくても、Prisma Studio で確認可:

```bash
npx prisma studio
```

`User` テーブルで自分の `availablePoints` が 10 増えていること (= 既存ユーザーで signup.bonus 未付与だった場合、ログイン後に +10)。
`PointTransaction` テーブルに `signup.bonus +10` レコードが追加されていること。

- [ ] **Step 2: もう一度ログインして二重付与されないことを確認**

ログアウト → ログイン → `PointTransaction` で `signup.bonus` が **1 件のまま** であること。

---

## Self-Review

**1. Spec coverage:**

| Spec 章 | 対応タスク |
|---|---|
| 2.1 User の 2 フィールド | Task 1 Step 1 |
| 2.2 Event.attendanceBonusPoints | Task 1 Step 4 |
| 2.3 AttendanceHistory.cancelType | Task 1 Step 3 |
| 2.4 PointTransaction / AchievementUnlock | Task 1 Step 2 |
| 3.3 addPoints の規約 (lifetime/available 区別、0 下限、delta=0 スキップ) | Task 2-3 |
| 6 priorityScore → availablePoints 転記 | Task 4 |
| 設計 3.1 signup.bonus +10 | Task 5 |

P2 以降の範囲 (キャンセル抑制ロジック / 実績バッジ / UI / no-show ボタン) は本プラン対象外で OK。

**2. Placeholder scan:** TBD/TODO は無し。すべてコードまたは具体的なコマンド付き。

**3. Type consistency:**
- `addPoints(userId, delta, reason, entity?: {type, id})` のシグネチャがテスト・実装・呼び出し側 (Task 5) で一致 ✅
- Prisma フィールド名 `lifetimePoints`/`availablePoints`/`PointTransaction`/`AchievementUnlock` がすべての箇所で一貫 ✅

---

**Plan complete.** 次のアクションをユーザーに確認してください:
- Subagent-Driven execution (推奨)
- Inline 実行 (executing-plans skill)
