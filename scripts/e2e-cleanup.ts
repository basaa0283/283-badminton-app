#!/usr/bin/env tsx
/**
 * E2E テストが DEV に残した残骸データを削除する。
 *
 * 主な対象識別子:
 *   - Event:        title    LIKE 'E2E %'
 *   - ShuttlePrice: memo     LIKE 'E2E %'
 *   - User:         nickname LIKE 'E2E_%'
 *
 * 削除順: Event → ShuttlePrice → (E2E User の依存レコード) → User
 *   - Event は Attendance / AttendanceHistory / Message が onDelete:Cascade なので
 *     Event 削除だけで紐づきが消える。
 *   - User は他テーブル (Attendance.userId 等) からの NoAction FK が多いので、
 *     User より先に依存レコードを userId ベースで削る必要がある。
 *
 * 実行: tsx scripts/e2e-cleanup.ts
 * 必須環境変数:
 *   DATABASE_URL    … 接続先 (DEV のみ想定)
 *   ALLOW_CLEANUP=1 … 暴発防止のスイッチ。明示的に 1 を指定しないと走らない。
 *
 * 本番DB を指す DATABASE_URL でも技術的には動くため、PROD ガードは
 * 「ALLOW_CLEANUP を CI の DEV ジョブでしか設定しない」という運用で担保する。
 */
import { PrismaClient } from "@prisma/client";

async function main() {
  if (process.env.ALLOW_CLEANUP !== "1") {
    console.error("ALLOW_CLEANUP=1 が未指定。安全のため中断します。");
    process.exit(2);
  }

  const url = process.env.DATABASE_URL ?? "";
  console.log(`[cleanup] DATABASE_URL host hint: ${url.split("@")[1]?.split(";")[0] ?? "(unknown)"}`);

  const prisma = new PrismaClient();
  try {
    // 1) Event (title LIKE 'E2E %') を削除 → Attendance / AttendanceHistory / Message は cascade
    const events = await prisma.event.deleteMany({
      where: { title: { startsWith: "E2E " } },
    });
    console.log(`[cleanup] Event deleted: ${events.count}`);

    // 2) ShuttlePrice (memo LIKE 'E2E %')
    const prices = await prisma.shuttlePrice.deleteMany({
      where: { memo: { startsWith: "E2E " } },
    });
    console.log(`[cleanup] ShuttlePrice deleted: ${prices.count}`);

    // 3) E2E User (nickname LIKE 'E2E_%') の依存レコードを先に消す
    const e2eUsers = await prisma.user.findMany({
      where: { nickname: { startsWith: "E2E_" } },
      select: { id: true },
    });
    const userIds = e2eUsers.map((u) => u.id);
    console.log(`[cleanup] E2E user candidates: ${userIds.length}`);

    if (userIds.length > 0) {
      const att = await prisma.attendance.deleteMany({ where: { userId: { in: userIds } } });
      const hist = await prisma.attendanceHistory.deleteMany({ where: { userId: { in: userIds } } });
      const inv = await prisma.invitationToken.deleteMany({ where: { userId: { in: userIds } } });
      const reads = await prisma.announcementRead.deleteMany({ where: { userId: { in: userIds } } });
      console.log(
        `[cleanup] dependents removed: attendances=${att.count} histories=${hist.count} invitations=${inv.count} announcementReads=${reads.count}`
      );

      // Announcement.createdById は nullable なので null 化
      const annUpd = await prisma.announcement.updateMany({
        where: { createdById: { in: userIds } },
        data: { createdById: null },
      });
      console.log(`[cleanup] Announcement createdBy nulled: ${annUpd.count}`);

      // 4) User 本体を削除
      const users = await prisma.user.deleteMany({
        where: { id: { in: userIds } },
      });
      console.log(`[cleanup] User deleted: ${users.count}`);
    }

    console.log("[cleanup] done.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("[cleanup] failed:", err);
  process.exit(1);
});
