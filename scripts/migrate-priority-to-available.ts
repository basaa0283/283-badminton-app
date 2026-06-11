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
