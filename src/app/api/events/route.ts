import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { permissions, UserRole } from "@/lib/permissions";
import { createEventSchema } from "@/lib/validations";

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
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");

    const now = new Date();
    const where = upcoming ? { eventDate: { gte: now } } : { eventDate: { lt: now } };

    const [events, total] = await Promise.all([
      prisma.event.findMany({
        where,
        orderBy: { eventDate: upcoming ? "asc" : "desc" },
        skip: (page - 1) * limit,
        take: limit,
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
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
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
        location: parsed.data.location || null,
        capacity: parsed.data.capacity || null,
        fee: parsed.data.fee || null,
        feeVisible: parsed.data.feeVisible,
        deadline: parsed.data.deadline ? new Date(parsed.data.deadline) : null,
        deadlineEnabled: parsed.data.deadlineEnabled,
        createdById: session.user.id,
      },
    });

    return NextResponse.json({ success: true, data: event }, { status: 201 });
  } catch (error) {
    console.error("Events POST error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "サーバーエラーが発生しました" } },
      { status: 500 }
    );
  }
}
