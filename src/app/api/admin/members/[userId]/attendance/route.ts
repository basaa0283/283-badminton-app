import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { permissions, UserRole } from "@/lib/permissions";
import { z } from "zod";

const proxyAttendanceSchema = z.object({
  eventId: z.string().min(1),
  status: z.enum(["attending", "not_attending"]),
});

// GET /api/admin/members/[userId]/attendance - 直近イベント一覧と対象ユーザーの出欠状況
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ success: false, error: { code: "UNAUTHORIZED" } }, { status: 401 });
    }
    const role = session.user.role as UserRole;
    if (!permissions.canAccessAdmin(role)) {
      return NextResponse.json({ success: false, error: { code: "FORBIDDEN" } }, { status: 403 });
    }

    const { userId } = await params;

    const events = await prisma.event.findMany({
      where: { eventDate: { gte: new Date() } },
      orderBy: { eventDate: "asc" },
      take: 10,
      include: {
        attendances: {
          where: { userId },
        },
        _count: { select: { attendances: { where: { status: "attending" } } } },
      },
    });

    const data = events.map((event) => ({
      id: event.id,
      title: event.title,
      eventDate: event.eventDate,
      location: event.location,
      capacity: event.capacity,
      attendingCount: event._count.attendances,
      attendance: event.attendances[0] ?? null,
    }));

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("GET /api/admin/members/[userId]/attendance error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: String(error) } },
      { status: 500 }
    );
  }
}

// POST /api/admin/members/[userId]/attendance - 代理出欠登録
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ success: false, error: { code: "UNAUTHORIZED" } }, { status: 401 });
    }
    const role = session.user.role as UserRole;
    if (!permissions.canAccessAdmin(role)) {
      return NextResponse.json({ success: false, error: { code: "FORBIDDEN" } }, { status: 403 });
    }

    const { userId } = await params;
    const body = await request.json();
    const parsed = proxyAttendanceSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message } },
        { status: 400 }
      );
    }

    const { eventId, status } = parsed.data;

    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: { attendances: { where: { status: "attending" } } },
    });
    if (!event) {
      return NextResponse.json({ success: false, error: { code: "NOT_FOUND" } }, { status: 404 });
    }

    const existing = await prisma.attendance.findUnique({
      where: { userId_eventId: { userId, eventId } },
    });

    // 現在と同じステータスなら何もしない
    if (existing?.status === status) {
      return NextResponse.json({ success: true, data: { status: existing.status, position: existing.position } });
    }

    let finalStatus: "attending" | "not_attending" | "waitlist" = status;
    let position: number | null = null;

    if (status === "attending" && event.capacity) {
      const currentAttending = event.attendances.filter((a) => a.userId !== userId).length;
      if (currentAttending >= event.capacity) {
        finalStatus = "waitlist";
        const maxPos = await prisma.attendance.aggregate({
          where: { eventId, status: "waitlist" },
          _max: { position: true },
        });
        position = (maxPos._max.position || 0) + 1;
      }
    }

    if (existing) {
      await prisma.attendance.update({
        where: { id: existing.id },
        data: { status: finalStatus, position: finalStatus === "waitlist" ? position : null },
      });
    } else {
      await prisma.attendance.create({
        data: { userId, eventId, status: finalStatus, position: finalStatus === "waitlist" ? position : null },
      });
    }

    await prisma.attendanceHistory.create({
      data: { userId, eventId, status: finalStatus, isProxy: true },
    });

    return NextResponse.json({ success: true, data: { status: finalStatus, position } });
  } catch (error) {
    console.error("POST /api/admin/members/[userId]/attendance error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: String(error) } },
      { status: 500 }
    );
  }
}
