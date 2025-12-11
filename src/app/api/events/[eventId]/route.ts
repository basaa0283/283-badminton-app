import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { permissions, UserRole } from "@/lib/permissions";
import { updateEventSchema } from "@/lib/validations";

interface Params {
  params: Promise<{ eventId: string }>;
}

// GET /api/events/[eventId] - イベント詳細取得
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "ログインが必要です" } },
        { status: 401 }
      );
    }

    const { eventId } = await params;
    const role = session.user.role as UserRole;

    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: {
        createdBy: {
          select: { nickname: true },
        },
        attendances: {
          include: {
            user: {
              select: {
                id: true,
                nickname: true,
                profileImageUrl: true,
                gender: true,
              },
            },
          },
          orderBy: [{ status: "asc" }, { position: "asc" }, { createdAt: "asc" }],
        },
      },
    });

    if (!event) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "イベントが見つかりません" } },
        { status: 404 }
      );
    }

    const attendingCount = event.attendances.filter((a) => a.status === "attending").length;
    const waitlistCount = event.attendances.filter((a) => a.status === "waitlist").length;
    const myAttendance = event.attendances.find((a) => a.user.id === session.user.id);

    // 参加者リストは member 以上のみ閲覧可能
    const canViewAttendees = permissions.canViewAttendeeList(role);

    return NextResponse.json({
      success: true,
      data: {
        id: event.id,
        title: event.title,
        description: event.description,
        eventDate: event.eventDate,
        eventEndDate: event.eventEndDate,
        location: event.location,
        capacity: event.capacity,
        fee: event.feeVisible ? event.fee : null,
        feeVisible: event.feeVisible,
        deadline: event.deadline,
        deadlineEnabled: event.deadlineEnabled,
        createdBy: event.createdBy.nickname,
        createdById: event.createdById,
        createdAt: event.createdAt,
        attendingCount,
        waitlistCount,
        myAttendance: myAttendance
          ? {
              id: myAttendance.id,
              status: myAttendance.status,
              comment: myAttendance.comment,
              position: myAttendance.position,
            }
          : null,
        attendees: canViewAttendees
          ? event.attendances.map((a) => ({
              id: a.id,
              status: a.status,
              comment: a.comment,
              position: a.position,
              createdAt: a.createdAt,
              user: a.user,
            }))
          : null,
      },
    });
  } catch (error) {
    console.error("Event GET error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "サーバーエラーが発生しました" } },
      { status: 500 }
    );
  }
}

// PUT /api/events/[eventId] - イベント更新
export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "ログインが必要です" } },
        { status: 401 }
      );
    }

    const role = session.user.role as UserRole;
    if (!permissions.canEditEvent(role)) {
      return NextResponse.json(
        { success: false, error: { code: "FORBIDDEN", message: "イベント編集の権限がありません" } },
        { status: 403 }
      );
    }

    const { eventId } = await params;
    const body = await request.json();
    const parsed = updateEventSchema.safeParse(body);

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

    const existing = await prisma.event.findUnique({ where: { id: eventId } });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "イベントが見つかりません" } },
        { status: 404 }
      );
    }

    const updateData: Record<string, unknown> = {};
    if (parsed.data.title !== undefined) updateData.title = parsed.data.title;
    if (parsed.data.description !== undefined) updateData.description = parsed.data.description || null;
    if (parsed.data.eventDate !== undefined) updateData.eventDate = new Date(parsed.data.eventDate);
    if (parsed.data.eventEndDate !== undefined)
      updateData.eventEndDate = parsed.data.eventEndDate ? new Date(parsed.data.eventEndDate) : null;
    if (parsed.data.location !== undefined) updateData.location = parsed.data.location || null;
    if (parsed.data.capacity !== undefined) updateData.capacity = parsed.data.capacity || null;
    if (parsed.data.fee !== undefined) updateData.fee = parsed.data.fee || null;
    if (parsed.data.feeVisible !== undefined) updateData.feeVisible = parsed.data.feeVisible;
    if (parsed.data.deadline !== undefined)
      updateData.deadline = parsed.data.deadline ? new Date(parsed.data.deadline) : null;
    if (parsed.data.deadlineEnabled !== undefined) updateData.deadlineEnabled = parsed.data.deadlineEnabled;

    const event = await prisma.event.update({
      where: { id: eventId },
      data: updateData,
    });

    return NextResponse.json({ success: true, data: event });
  } catch (error) {
    console.error("Event PUT error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "サーバーエラーが発生しました" } },
      { status: 500 }
    );
  }
}

// DELETE /api/events/[eventId] - イベント削除
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "ログインが必要です" } },
        { status: 401 }
      );
    }

    const role = session.user.role as UserRole;
    if (!permissions.canDeleteEvent(role)) {
      return NextResponse.json(
        { success: false, error: { code: "FORBIDDEN", message: "イベント削除の権限がありません" } },
        { status: 403 }
      );
    }

    const { eventId } = await params;

    const existing = await prisma.event.findUnique({ where: { id: eventId } });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "イベントが見つかりません" } },
        { status: 404 }
      );
    }

    await prisma.event.delete({ where: { id: eventId } });

    return NextResponse.json({ success: true, data: { message: "イベントを削除しました" } });
  } catch (error) {
    console.error("Event DELETE error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "サーバーエラーが発生しました" } },
      { status: 500 }
    );
  }
}
