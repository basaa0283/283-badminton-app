import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { permissions, UserRole } from "@/lib/permissions";
import { logActivity } from "@/lib/activity-log";
import { deleteUserCascade } from "@/lib/user-delete";

// POST /api/admin/members/cleanup-held
// 60 日以上保留中の pending ユーザーを削除する。
// 現状は管理画面からの手動実行のみ (将来 CRON 化前提)。
const HOLD_LIMIT_DAYS = 60;

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED" } },
        { status: 401 },
      );
    }
    const role = session.user.role as UserRole;
    if (!permissions.canAccessAdmin(role)) {
      return NextResponse.json(
        { success: false, error: { code: "FORBIDDEN" } },
        { status: 403 },
      );
    }

    const cutoff = new Date();
    cutoff.setUTCDate(cutoff.getUTCDate() - HOLD_LIMIT_DAYS);

    const targets = await prisma.user.findMany({
      where: { role: "pending", holdAt: { lt: cutoff } },
      select: { id: true, nickname: true, holdAt: true },
    });

    for (const t of targets) {
      try {
        await deleteUserCascade(t.id);
        void logActivity({
          userId: session.user.id,
          action: "member.auto_reject",
          entityType: "User",
          entityId: t.id,
          metadata: {
            targetNickname: t.nickname,
            heldDays: HOLD_LIMIT_DAYS,
            heldSince: t.holdAt,
          },
        });
      } catch (e) {
        console.error(`[cleanup-held] delete failed for ${t.id}:`, e);
      }
    }

    return NextResponse.json({
      success: true,
      data: { deletedCount: targets.length, holdLimitDays: HOLD_LIMIT_DAYS },
    });
  } catch (error) {
    console.error("cleanup-held POST error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "サーバーエラーが発生しました" } },
      { status: 500 },
    );
  }
}
