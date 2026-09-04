import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { permissions, UserRole } from "@/lib/permissions";
import { addPoints } from "@/lib/points";
import { getDefaultTenantId } from "@/lib/tenant";

interface Params {
  params: Promise<{ eventId: string; attendanceId: string }>;
}

// PUT /api/admin/events/[eventId]/attendees/[attendanceId]/cancel-flag
// body: { type: "same_day_no_notice" | "no_show" | null }
// 管理者が「連絡なし当日キャンセル」「no-show」を手動でフラグ付け or 取消する。
//
// 振る舞い:
//   - 現在の cancelType と新しい type が同じ → 何もしない (二重防止)
//   - 旧 type の減点を「逆方向の PointTransaction」で打ち消し、新 type の減点を入れる
//     例: null → "no_show" なら -5pt
//         "same_day_no_notice" → null なら +3pt
//         "same_day_no_notice" → "no_show" なら +3pt - 5pt = -2pt 相当 (2 つの PointTransaction で記録)
const PENALTY: Record<string, number> = {
  regular: 0,
  same_day_with_notice: -1,
  same_day_no_notice: -3,
  no_show: -5,
};

export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED" } },
        { status: 401 },
      );
    }
    if (!permissions.canAccessAdmin(session.user.role as UserRole)) {
      return NextResponse.json(
        { success: false, error: { code: "FORBIDDEN" } },
        { status: 403 },
      );
    }
    const { eventId, attendanceId } = await params;
    const body = await request.json();
    const newType: string | null = body?.type ?? null;
    if (
      newType !== null &&
      newType !== "same_day_no_notice" &&
      newType !== "no_show"
    ) {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_TYPE" } },
        { status: 400 },
      );
    }

    const attendance = await prisma.attendance.findUnique({
      where: { id: attendanceId },
    });
    if (!attendance || attendance.eventId !== eventId) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND" } },
        { status: 404 },
      );
    }

    const oldType = attendance.cancelType ?? null;
    if (oldType === newType) {
      return NextResponse.json({ success: true, data: { changed: false } });
    }

    // 旧ペナルティを打ち消し (= 復元、正の delta)
    const oldPenalty = oldType ? PENALTY[oldType] ?? 0 : 0;
    if (oldPenalty < 0) {
      await addPoints(
        attendance.userId,
        -oldPenalty,
        `cancel.${oldType}.revert`,
        { type: "Event", id: eventId },
      );
    }

    // 新ペナルティを適用
    const newPenalty = newType ? PENALTY[newType] ?? 0 : 0;
    if (newPenalty < 0) {
      await addPoints(
        attendance.userId,
        newPenalty,
        `cancel.${newType}`,
        { type: "Event", id: eventId },
      );
    }

    await prisma.attendance.update({
      where: { id: attendanceId },
      data: { cancelType: newType },
    });

    // AttendanceHistory にも残す (管理者操作ログ的に)
    const tenantId = await getDefaultTenantId();
    await prisma.attendanceHistory.create({
      data: {
        userId: attendance.userId,
        eventId,
        status: attendance.status,
        comment: `[admin cancel-flag] ${oldType ?? "none"} → ${newType ?? "none"}`,
        cancelType: newType,
        tenantId,
      },
    });

    return NextResponse.json({
      success: true,
      data: { oldType, newType, changed: true },
    });
  } catch (error) {
    console.error("cancel-flag PUT error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "サーバーエラーが発生しました" } },
      { status: 500 },
    );
  }
}
