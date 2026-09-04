import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { permissions, UserRole } from "@/lib/permissions";
import { getDefaultTenantId } from "@/lib/tenant";
import { z } from "zod";

const createSchema = z.object({
  userId: z.string().min(1),
  // 代理での出欠付与は「参加 / 不参加 / 見学」の3択。waitlist は内部状態なので外部から指定不可。
  status: z.enum(["attending", "not_attending", "observing"]),
  // 大会連動イベントの場合、申告クラス (TournamentClass.id) も同時に指定可能。
  declaredTournamentClassId: z.string().nullable().optional(),
});

interface Params {
  params: Promise<{ eventId: string }>;
}

// POST /api/events/[eventId]/attendances - admin が attendance を新規追加 (deadline / 過去 無視)
export async function POST(request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ success: false, error: { code: "UNAUTHORIZED" } }, { status: 401 });
  }
  const role = session.user.role as UserRole;
  if (!permissions.canAccessAdmin(role)) {
    return NextResponse.json({ success: false, error: { code: "FORBIDDEN" } }, { status: 403 });
  }

  const { eventId } = await params;
  const body = await request.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message } },
      { status: 400 }
    );
  }

  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) {
    return NextResponse.json({ success: false, error: { code: "NOT_FOUND" } }, { status: 404 });
  }

  const existing = await prisma.attendance.findUnique({
    where: { userId_eventId: { userId: parsed.data.userId, eventId } },
  });

  // 申告クラスは attending の時だけ意味があるので、それ以外は null に。
  const declaredClassId =
    parsed.data.status === "attending"
      ? parsed.data.declaredTournamentClassId ?? null
      : null;

  if (existing) {
    const updated = await prisma.attendance.update({
      where: { id: existing.id },
      data: {
        status: parsed.data.status,
        position: null,
        declaredTournamentClassId: declaredClassId,
      },
    });
    return NextResponse.json({ success: true, data: updated });
  }

  const tenantId = await getDefaultTenantId();
  const created = await prisma.attendance.create({
    data: {
      userId: parsed.data.userId,
      eventId,
      status: parsed.data.status,
      declaredTournamentClassId: declaredClassId,
      tenantId,
    },
  });

  await prisma.attendanceHistory.create({
    data: { userId: parsed.data.userId, eventId, status: parsed.data.status, isProxy: true, tenantId },
  });

  return NextResponse.json({ success: true, data: created }, { status: 201 });
}
