import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { permissions, UserRole } from "@/lib/permissions";
import { createEventSchema } from "@/lib/validations";
import { notifyNewEvent } from "@/lib/line-messaging";

// GET /api/events - イベント一覧取得
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "ログインが必要です" } },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const upcoming = searchParams.get("upcoming") !== "false";

    const now = new Date();
    // 過去イベントは「当月＋先月」のみ表示する。それ以前は管理者画面から見る。
    const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const dateWhere = upcoming
      ? { eventDate: { gte: now } }
      : { eventDate: { gte: startOfPrevMonth, lt: now } };

    // 閾値方式: 各イベントの minViewRole に対し、現在のロールが届いているもののみ。
    //   - admin / subadmin は閾値に関わらず常に全件
    //   - member は minViewRole in {guest, visitor, member}
    //   - visitor は minViewRole in {guest, visitor}
    //   - guest / pending は minViewRole = "guest" のみ
    const role = session.user.role as UserRole;
    const visibleRoleFilter: string[] | null =
      role === "admin" || role === "subadmin"
        ? null
        : role === "member"
          ? ["guest", "visitor", "member"]
          : role === "visitor"
            ? ["guest", "visitor"]
            : ["guest"]; // guest / pending
    const where =
      visibleRoleFilter === null
        ? dateWhere
        : { ...dateWhere, minViewRole: { in: visibleRoleFilter } };

    const [events, total] = await Promise.all([
      prisma.event.findMany({
        where,
        orderBy: { eventDate: upcoming ? "asc" : "desc" },
        include: {
          attendances: {
            select: {
              status: true,
              userId: true,
              comment: true,
              position: true,
            },
          },
          createdBy: {
            select: {
              nickname: true,
            },
          },
          category: true,
        },
      }),
      prisma.event.count({ where }),
    ]);

    const userId = session.user.id;
    const eventsWithCounts = events.map((event) => {
      const attendingCount = event.attendances.filter((a) => a.status === "attending").length;
      const waitlistCount = event.attendances.filter((a) => a.status === "waitlist").length;
      const myAttendance = event.attendances.find((a) => a.userId === userId);

      return {
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
        category: event.category
          ? { id: event.category.id, name: event.category.name, color: event.category.color }
          : null,
        cancelledAt: event.cancelledAt,
        cancelReason: event.cancelReason,
        createdBy: event.createdBy.nickname,
        attendingCount,
        waitlistCount,
        myAttendance: myAttendance
          ? {
              status: myAttendance.status,
              comment: myAttendance.comment,
              position: myAttendance.position,
            }
          : null,
      };
    });

    return NextResponse.json({
      success: true,
      data: eventsWithCounts,
      // 過去イベントは「当月＋先月」、未来イベントは全期間で、ページング廃止。
      // 型互換のため pagination は自己整合な値で残しておく。
      pagination: {
        page: 1,
        limit: total,
        total,
        totalPages: 1,
      },
    });
  } catch (error) {
    console.error("Events GET error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "サーバーエラーが発生しました" } },
      { status: 500 }
    );
  }
}

// POST /api/events - イベント作成
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "ログインが必要です" } },
        { status: 401 }
      );
    }

    const role = session.user.role as UserRole;
    if (!permissions.canCreateEvent(role)) {
      return NextResponse.json(
        { success: false, error: { code: "FORBIDDEN", message: "イベント作成の権限がありません" } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = createEventSchema.safeParse(body);

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

    const event = await prisma.event.create({
      data: {
        title: parsed.data.title,
        description: parsed.data.description || null,
        eventDate: new Date(parsed.data.eventDate),
        eventEndDate: parsed.data.eventEndDate ? new Date(parsed.data.eventEndDate) : null,
        isAllDay: parsed.data.isAllDay ?? false,
        location: parsed.data.location || null,
        capacity: parsed.data.capacity || null,
        fee: parsed.data.fee || null,
        feeVisible: parsed.data.feeVisible,
        deadline: parsed.data.deadline ? new Date(parsed.data.deadline) : null,
        deadlineEnabled: parsed.data.deadlineEnabled,
        respondStartAt: parsed.data.respondStartAt ? new Date(parsed.data.respondStartAt) : null,
        categoryId: parsed.data.categoryId ?? null,
        minViewRole: parsed.data.minViewRole ?? "visitor",
        minRespondRole: parsed.data.minRespondRole ?? "visitor",
        shuttleCount: parsed.data.shuttleCount ?? null,
        shuttleCost: parsed.data.shuttleCost ?? null,
        gymCost: parsed.data.gymCost ?? null,
        otherCost: parsed.data.otherCost ?? null,
        otherMemo: parsed.data.otherMemo ?? null,
        actualRevenue: parsed.data.actualRevenue ?? null,
        createdById: session.user.id,
      },
    });

    if (parsed.data.notifyMembers) {
      const members = await prisma.user.findMany({
        where: {
          role: { in: ["member", "subadmin", "admin"] },
          lineId: { not: null },
        },
        select: { lineId: true },
      });
      const lineIds = members.map((u) => u.lineId as string);
      const appUrl = process.env.NEXTAUTH_URL || "";
      notifyNewEvent({
        lineIds,
        eventTitle: event.title,
        eventDate: event.eventDate,
        location: event.location,
        appUrl,
      }).catch((err) => console.error("[notify] new event failed:", err));
    }

    return NextResponse.json({ success: true, data: event }, { status: 201 });
  } catch (error) {
    console.error("Events POST error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "サーバーエラーが発生しました" } },
      { status: 500 }
    );
  }
}
