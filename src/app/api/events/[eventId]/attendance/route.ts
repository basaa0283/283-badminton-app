import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { attendanceSchema } from "@/lib/validations";

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

    // 締め切りチェック
    if (event.deadlineEnabled && event.deadline && new Date(event.deadline) < new Date()) {
      return NextResponse.json(
        { success: false, error: { code: "DEADLINE_PASSED", message: "締め切りを過ぎています" } },
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

    if (existingAttendance) {
      // 更新
      await prisma.attendance.update({
        where: { id: existingAttendance.id },
        data: {
          status: status === "waitlist" ? "waitlist" : parsed.data.status,
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
          status: status === "waitlist" ? "waitlist" : parsed.data.status,
          comment: parsed.data.comment || null,
          position: status === "waitlist" ? position : null,
        },
      });
    }

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
async function promoteFromWaitlist(eventId: string, capacity: number | null) {
  if (!capacity) return;

  const currentAttending = await prisma.attendance.count({
    where: { eventId, status: "attending" },
  });

  if (currentAttending >= capacity) return;

  // 繰り上げ対象（position が最小のもの）
  const nextInLine = await prisma.attendance.findFirst({
    where: { eventId, status: "waitlist" },
    orderBy: { position: "asc" },
    include: { user: true },
  });

  if (!nextInLine) return;

  // 繰り上げ
  await prisma.attendance.update({
    where: { id: nextInLine.id },
    data: { status: "attending", position: null },
  });

  // 残りのキャンセル待ちの position を更新
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

  // TODO: LINE通知を送信
  // if (nextInLine.user.lineId) {
  //   await sendLineNotification(nextInLine.user.lineId, "キャンセル待ちから繰り上げになりました！");
  // }

  console.log(`Promoted user ${nextInLine.user.nickname} from waitlist for event ${eventId}`);
}
