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
