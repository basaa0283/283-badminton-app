import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { permissions, UserRole } from "@/lib/permissions";
import { z } from "zod";

const mergeSchema = z.object({
  provisionalUserId: z.string().min(1),
});

interface Params {
  params: Promise<{ userId: string }>;
}

// PUT /api/admin/members/[userId]/merge
// 承認画面で「既存の仮アカウントとマージ」を実行する。
//   - URL の userId: ゲスト動線で来た pending ユーザー (LINE 連携済み、これを残す)
//   - body.provisionalUserId: 管理者が事前に作成していた visitor 仮アカウント
//                              (この行は削除し、プロフィール / 出欠 / role を pending 側に移す)
//
// /api/invite/complete とほぼ同じ移行ロジック。
export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED" } },
        { status: 401 }
      );
    }
    const role = session.user.role as UserRole;
    if (!permissions.canAccessAdmin(role)) {
      return NextResponse.json(
        { success: false, error: { code: "FORBIDDEN" } },
        { status: 403 }
      );
    }

    const { userId } = await params;
    const body = await request.json();
    const parsed = mergeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message } },
        { status: 400 }
      );
    }
    const provisionalUserId = parsed.data.provisionalUserId;

    if (userId === provisionalUserId) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "同じユーザーをマージ対象にはできません" } },
        { status: 400 }
      );
    }

    const pendingUser = await prisma.user.findUnique({ where: { id: userId } });
    const provisionalUser = await prisma.user.findUnique({
      where: { id: provisionalUserId },
      include: { attendances: true, attendanceHistories: true },
    });

    if (!pendingUser || !provisionalUser) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND" } },
        { status: 404 }
      );
    }

    // 安全弁: 仮アカウント側に lineId が紐づいている (= 実ユーザー連携済み) なら拒否
    if (provisionalUser.lineId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "PROVISIONAL_HAS_LINE",
            message: "マージ対象の仮アカウントが既に LINE 連携されています。手動で再確認してください。",
          },
        },
        { status: 400 }
      );
    }

    await prisma.$transaction(async (tx) => {
      // 出欠を pending 側に移行 (同一イベントの重複は仮アカウント側を優先)
      for (const attendance of provisionalUser.attendances) {
        const existing = await tx.attendance.findUnique({
          where: { userId_eventId: { userId, eventId: attendance.eventId } },
        });
        if (existing) {
          await tx.attendance.delete({ where: { id: existing.id } });
        }
        await tx.attendance.update({
          where: { id: attendance.id },
          data: { userId },
        });
      }

      if (provisionalUser.attendanceHistories.length > 0) {
        await tx.attendanceHistory.updateMany({
          where: { userId: provisionalUserId },
          data: { userId },
        });
      }

      // 仮アカウントのプロフィール情報を pending 側に反映 (role もそのまま受け継ぐ。
      // 仮アカウントが "visitor" なら pending → visitor、という運用)。
      await tx.user.update({
        where: { id: userId },
        data: {
          nickname: provisionalUser.nickname !== "名無し" ? provisionalUser.nickname : undefined,
          firstName: provisionalUser.firstName ?? undefined,
          lastName: provisionalUser.lastName ?? undefined,
          gender: provisionalUser.gender ?? undefined,
          birthdate: provisionalUser.birthdate ?? undefined,
          ageVisible: provisionalUser.ageVisible,
          comment: provisionalUser.comment ?? undefined,
          role: provisionalUser.role,
          skillLevel: provisionalUser.skillLevel ?? undefined,
          adminNote: provisionalUser.adminNote ?? undefined,
        },
      });

      // 仮アカウントに紐付くトークン類を先に削除 (SQL Server: NoAction の FK 対応)
      await tx.invitationToken.deleteMany({ where: { userId: provisionalUserId } });
      await tx.announcementRead.deleteMany({ where: { userId: provisionalUserId } });

      // 仮アカウント本体を削除
      await tx.user.delete({ where: { id: provisionalUserId } });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PUT /api/admin/members/[userId]/merge error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: String(error) } },
      { status: 500 }
    );
  }
}
