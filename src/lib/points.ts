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
