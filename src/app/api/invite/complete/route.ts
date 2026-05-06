import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// POST /api/invite/complete - LINEログイン後に仮アカウントとマージ
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ success: false, error: { code: "UNAUTHORIZED" } }, { status: 401 });
    }

    const body = await request.json();
    const { token } = body as { token: string };
    if (!token) {
      return NextResponse.json({ success: false, error: { code: "VALIDATION_ERROR" } }, { status: 400 });
    }

    const invitation = await prisma.invitationToken.findUnique({
      where: { token },
      include: {
        user: {
          include: {
            attendances: true,
            attendanceHistories: true,
          },
        },
      },
    });

    if (!invitation) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "招待リンクが見つかりません" } },
        { status: 404 }
      );
    }

    if (invitation.expiresAt < new Date()) {
      return NextResponse.json(
        { success: false, error: { code: "EXPIRED", message: "招待リンクの有効期限が切れています" } },
        { status: 410 }
      );
    }

    const provisionalUser = invitation.user;
    const currentUserId = session.user.id;

    // 自分自身への招待は無効
    if (provisionalUser.id === currentUserId) {
      return NextResponse.json(
        { success: false, error: { code: "INVALID", message: "無効な招待です" } },
        { status: 400 }
      );
    }

    await prisma.$transaction(async (tx) => {
      // 仮アカウントの出欠を現ユーザーに移行（重複するイベントは仮アカウント側を優先）
      for (const attendance of provisionalUser.attendances) {
        const existing = await tx.attendance.findUnique({
          where: { userId_eventId: { userId: currentUserId, eventId: attendance.eventId } },
        });
        if (existing) {
          await tx.attendance.delete({ where: { id: existing.id } });
        }
        await tx.attendance.update({
          where: { id: attendance.id },
          data: { userId: currentUserId },
        });
      }

      // 出欠履歴を現ユーザーに移行
      if (provisionalUser.attendanceHistories.length > 0) {
        await tx.attendanceHistory.updateMany({
          where: { userId: provisionalUser.id },
          data: { userId: currentUserId },
        });
      }

      // 仮アカウントのプロフィール情報を現ユーザーに反映
      await tx.user.update({
        where: { id: currentUserId },
        data: {
          nickname: provisionalUser.nickname !== "名無し" ? provisionalUser.nickname : undefined,
          firstName: provisionalUser.firstName ?? undefined,
          lastName: provisionalUser.lastName ?? undefined,
          gender: provisionalUser.gender ?? undefined,
          age: provisionalUser.age ?? undefined,
          ageVisible: provisionalUser.ageVisible,
          comment: provisionalUser.comment ?? undefined,
          role: provisionalUser.role === "visitor" ? "member" : provisionalUser.role,
          skillLevel: provisionalUser.skillLevel ?? undefined,
          adminNote: provisionalUser.adminNote ?? undefined,
        },
      });

      // InvitationTokenを先に削除（SQL ServerはonDelete: NoActionのためカスケード削除されない）
      await tx.invitationToken.deleteMany({ where: { userId: provisionalUser.id } });

      // 仮アカウント削除
      await tx.user.delete({ where: { id: provisionalUser.id } });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST /api/invite/complete error:", error);
    return NextResponse.json({ success: false, error: { code: "INTERNAL_ERROR", message: String(error) } }, { status: 500 });
  }
}
