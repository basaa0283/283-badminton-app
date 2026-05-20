import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { permissions, UserRole } from "@/lib/permissions";
import { createEventSchema } from "@/lib/validations";
import { notifyNewEvent } from "@/lib/line-messaging";
import { formatInTimeZone } from "date-fns-tz";
import { ja } from "date-fns/locale";

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
    // 過去イベント取得時の遡及期間 (月数)。デフォルト 3 か月。
    // フロントの「もっと前を見る」が押されるたびに増やして再取得する。
    const monthsBackParam = Number(searchParams.get("monthsBack"));
    const monthsBack =
      Number.isFinite(monthsBackParam) && monthsBackParam > 0
        ? Math.min(Math.floor(monthsBackParam), 240) // 上限 20 年
        : 3;

    const now = new Date();
    const pastStart = new Date(now.getFullYear(), now.getMonth() - monthsBack, 1);
    const dateWhere = upcoming
      ? { eventDate: { gte: now } }
      : { eventDate: { gte: pastStart, lt: now } };

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
    const baseWhere =
      visibleRoleFilter === null
        ? dateWhere
        : { ...dateWhere, minViewRole: { in: visibleRoleFilter } };

    // 過去イベント (upcoming=false) は管理者以外には「自分が参加したもの」のみ。
    // 他人の過去履歴を眺めるユースケースが無いので一覧をシンプルに保つ。
    const isAdmin = role === "admin" || role === "subadmin";
    const where =
      !upcoming && !isAdmin
        ? {
            ...baseWhere,
            attendances: { some: { userId: session.user.id, status: "attending" } },
          }
        : baseWhere;

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
        isAllDay: event.isAllDay,
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

    // お知らせにも投稿: イベント情報を定型文で Announcement として作成。
    // 公開対象は member/visitor。guest はイベント詳細で見ればよく、お知らせは
    // 内部メンバー向けの位置づけ。後から /admin/announcements で編集可。
    if (parsed.data.announceOnCreate) {
      const lines = [
        event.title,
        `📅 ${formatInTimeZone(event.eventDate, "Asia/Tokyo", "M月d日(E) HH:mm", { locale: ja })}`,
        event.location ? `📍 ${event.location}` : null,
        "",
        "詳しくはアプリ「イベント一覧」をご確認ください。",
      ].filter((l): l is string => l !== null);
      await prisma.announcement
        .create({
          data: {
            title: `イベント追加: ${event.title}`,
            body: lines.join("\n"),
            severity: "info",
            audienceMember: true,
            audienceVisitor: true,
            audienceGuest: false,
            createdById: session.user.id,
          },
        })
        .catch((err) => console.error("[announce] new event announcement failed:", err));
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
