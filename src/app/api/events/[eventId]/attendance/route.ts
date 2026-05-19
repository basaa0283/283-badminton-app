import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { attendanceSchema } from "@/lib/validations";
import { notifyWaitlistPromotion } from "@/lib/line-messaging";
import { permissions, UserRole, meetsRoleThreshold } from "@/lib/permissions";

interface Params {
  params: Promise<{ eventId: string }>;
}

// POST /api/events/[eventId]/attendance - 出欠登録
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "ログインが必要です" } },
        { status: 401 }
      );
    }

    const role = session.user.role as UserRole;
    if (!permissions.canRespondToEvent(role)) {
      return NextResponse.json(
        { success: false, error: { code: "FORBIDDEN", message: "出欠回答の権限がありません" } },
        { status: 403 }
      );
    }

    const { eventId } = await params;
    const body = await request.json();
    const parsed = attendanceSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: parsed.error.issues[0]?.message || "入力内容に誤りがあります",
          },
        },
        { status: 400 }
      );
    }

    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: {
        attendances: {
          where: { status: "attending" },
        },
      },
    });

    if (!event) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "イベントが見つかりません" } },
        { status: 404 }
      );
    }

    // 閾値: event.minRespondRole に届かないロールは回答不可。
    // canRespondToEvent でグローバルに guest を弾いた後、イベント個別の閾値で更に絞る。
    if (!meetsRoleThreshold(role, event.minRespondRole)) {
      return NextResponse.json(
        { success: false, error: { code: "FORBIDDEN", message: "このイベントには回答できません" } },
        { status: 403 }
      );
    }

    // 締め切りチェック
    if (event.deadlineEnabled && event.deadline && new Date(event.deadline) < new Date()) {
      return NextResponse.json(
        { success: false, error: { code: "DEADLINE_PASSED", message: "締め切りを過ぎています" } },
        { status: 400 }
      );
    }

    // 回答開始日時前のチェック
    if (event.respondStartAt && new Date(event.respondStartAt) > new Date()) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_OPEN", message: "回答受付開始前です" } },
        { status: 400 }
      );
    }

    const userId = session.user.id;
    const existingAttendance = await prisma.attendance.findUnique({
      where: { userId_eventId: { userId, eventId } },
    });

    let status: "attending" | "not_attending" | "waitlist" = parsed.data.status;
    let position: number | null = null;

    // 参加の場合、定員チェック
    if (status === "attending" && event.capacity) {
      const currentAttending = event.attendances.filter(
        (a) => a.userId !== userId // 自分の既存参加は除外
      ).length;

      if (currentAttending >= event.capacity) {
        // キャンセル待ちに
        status = "waitlist";
        const maxPosition = await prisma.attendance.aggregate({
          where: { eventId, status: "waitlist" },
          _max: { position: true },
        });
        position = (maxPosition._max.position || 0) + 1;
      }
    }

    // 既存の参加から不参加に変更する場合、キャンセル待ち繰り上げ処理
    const wasAttending = existingAttendance?.status === "attending";
    const isNowNotAttending = parsed.data.status === "not_attending";

    const finalStatus = status === "waitlist" ? "waitlist" : parsed.data.status;

    if (existingAttendance) {
      // 更新
      await prisma.attendance.update({
        where: { id: existingAttendance.id },
        data: {
          status: finalStatus,
          comment: parsed.data.comment || null,
          position: status === "waitlist" ? position : null,
        },
      });
    } else {
      // 新規作成
      await prisma.attendance.create({
        data: {
          userId,
          eventId,
          status: finalStatus,
          comment: parsed.data.comment || null,
          position: status === "waitlist" ? position : null,
        },
      });
    }

    // 出欠履歴を記録
    await prisma.attendanceHistory.create({
      data: {
        userId,
        eventId,
        status: finalStatus,
        comment: parsed.data.comment || null,
      },
    });

    // lastActiveAtを更新
    await prisma.user.update({
      where: { id: userId },
      data: { lastActiveAt: new Date() },
    });

    // 参加→不参加の場合、キャンセル待ち繰り上げ
    if (wasAttending && isNowNotAttending) {
      await promoteFromWaitlist(eventId, event.capacity);
    }

    const attendance = await prisma.attendance.findUnique({
      where: { userId_eventId: { userId, eventId } },
    });

    return NextResponse.json({
      success: true,
      data: {
        status: attendance?.status,
        comment: attendance?.comment,
        position: attendance?.position,
        message:
          status === "waitlist"
            ? `キャンセル待ち ${position}番目として登録しました`
            : parsed.data.status === "attending"
            ? "参加登録しました"
            : "不参加で登録しました",
      },
    });
  } catch (error) {
    console.error("Attendance POST error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "サーバーエラーが発生しました" } },
      { status: 500 }
    );
  }
}

// キャンセル待ち繰り上げ処理
// SystemSetting.waitlistPolicy で挙動を切り替える:
//   "fifo" (デフォルト): position が最小 = 一番早くキャンセル待ちに入った人を繰り上げる
//   "priority":          user.priorityScore が大きい順 → 同点は createdAt 昇順
async function promoteFromWaitlist(eventId: string, capacity: number | null) {
  if (!capacity) return;

  const currentAttending = await prisma.attendance.count({
    where: { eventId, status: "attending" },
  });

  if (currentAttending >= capacity) return;

  const policyRow = await prisma.systemSetting.findUnique({
    where: { key: "waitlistPolicy" },
  });
  const policy = policyRow?.value === "priority" ? "priority" : "fifo";

  // 繰り上げ対象を選ぶ
  let nextInLine;
  if (policy === "priority") {
    // priorityScore desc → createdAt asc。Prisma の orderBy で複数キーを指定。
    nextInLine = await prisma.attendance.findFirst({
      where: { eventId, status: "waitlist" },
      orderBy: [
        { user: { priorityScore: "desc" } },
        { createdAt: "asc" },
      ],
      include: { user: true },
    });
  } else {
    nextInLine = await prisma.attendance.findFirst({
      where: { eventId, status: "waitlist" },
      orderBy: { position: "asc" },
      include: { user: true },
    });
  }

  if (!nextInLine) return;

  // 繰り上げ
  await prisma.attendance.update({
    where: { id: nextInLine.id },
    data: { status: "attending", position: null },
  });

  // 残りのキャンセル待ちの position を詰める。
  // priority モードでも position は「キャンセル待ちに入った順」を保持しておく
  // (画面表示・履歴用途)。繰り上がった人より後ろの position を decrement。
  await prisma.attendance.updateMany({
    where: {
      eventId,
      status: "waitlist",
      position: { gt: nextInLine.position || 0 },
    },
    data: {
      position: { decrement: 1 },
    },
  });

  if (nextInLine.user.lineId) {
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (event) {
      notifyWaitlistPromotion({
        lineId: nextInLine.user.lineId,
        eventTitle: event.title,
        eventDate: event.eventDate,
        location: event.location,
      }).catch((err) => console.error("[notify] waitlist promotion failed:", err));
    }
  }

  console.log(`Promoted user ${nextInLine.user.nickname} from waitlist for event ${eventId}`);
}
