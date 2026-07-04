import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { permissions, UserRole, meetsRoleThreshold } from "@/lib/permissions";
import { logActivity } from "@/lib/activity-log";

interface Params {
  params: Promise<{ eventId: string }>;
}

// GET /api/events/[eventId]/messages
// イベント当日連絡 (単方向) の一覧を返す。
// 自分の Attendance ステータスに応じて表示対象を絞る:
//   - message.targetType="attending"              => attending の人だけに見える
//   - message.targetType="attending_or_undecided" => attending または Attendance レコードなしの人に見える
//   - message.targetType="all"                    => イベントを閲覧できる人全員
// admin/subadmin は常に全て見える (=運用確認のため)。
export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED" } },
        { status: 401 },
      );
    }
    const { eventId } = await params;
    const role = session.user.role as UserRole;

    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true, minViewRole: true, status: true, createdById: true },
    });
    if (!event) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND" } },
        { status: 404 },
      );
    }
    const isAdmin = permissions.canAccessAdmin(role);
    // イベント閲覧権限 (draft は作成者/admin のみ)
    if (!isAdmin && event.createdById !== session.user.id) {
      if (event.status === "draft") {
        return NextResponse.json(
          { success: false, error: { code: "NOT_FOUND" } },
          { status: 404 },
        );
      }
      if (!meetsRoleThreshold(role, event.minViewRole)) {
        return NextResponse.json(
          { success: false, error: { code: "NOT_FOUND" } },
          { status: 404 },
        );
      }
    }

    const [messages, myAttendance] = await Promise.all([
      prisma.message.findMany({
        where: { eventId },
        orderBy: { sentAt: "desc" },
        include: {
          sender: { select: { id: true, nickname: true, profileImageUrl: true } },
        },
      }),
      prisma.attendance.findUnique({
        where: { userId_eventId: { userId: session.user.id, eventId } },
        select: { status: true },
      }),
    ]);

    const attendanceStatus = myAttendance?.status ?? null;

    const visible = messages.filter((m) => {
      if (isAdmin) return true;
      if (m.targetType === "all") return true;
      if (m.targetType === "attending") return attendanceStatus === "attending";
      if (m.targetType === "attending_or_undecided") {
        return attendanceStatus === "attending" || attendanceStatus === null;
      }
      return false;
    });

    return NextResponse.json({
      success: true,
      data: visible.map((m) => ({
        id: m.id,
        content: m.content,
        targetType: m.targetType,
        sentAt: m.sentAt,
        sender: m.sender,
      })),
    });
  } catch (error) {
    console.error("event messages GET error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: String(error) } },
      { status: 500 },
    );
  }
}

// POST /api/events/[eventId]/messages
// 管理者のみ投稿可。body: { content: string, targetType?: string }
const ALLOWED_TARGETS = new Set(["attending", "attending_or_undecided", "all"]);

export async function POST(request: NextRequest, { params }: Params) {
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
    const { eventId } = await params;
    const body = await request.json();
    const content = typeof body?.content === "string" ? body.content.trim() : "";
    const targetType = typeof body?.targetType === "string" ? body.targetType : "attending_or_undecided";
    if (!content) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "本文は必須です" } },
        { status: 400 },
      );
    }
    if (content.length > 2000) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "本文は 2000 文字以内で入力してください" } },
        { status: 400 },
      );
    }
    if (!ALLOWED_TARGETS.has(targetType)) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "対象範囲が不正です" } },
        { status: 400 },
      );
    }

    const msg = await prisma.message.create({
      data: {
        eventId,
        senderId: session.user.id,
        content,
        targetType,
      },
    });
    void logActivity({
      userId: session.user.id,
      action: "event_message.post",
      entityType: "Event",
      entityId: eventId,
      metadata: { messageId: msg.id, targetType },
    });
    return NextResponse.json({ success: true, data: { id: msg.id } });
  } catch (error) {
    console.error("event messages POST error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: String(error) } },
      { status: 500 },
    );
  }
}
