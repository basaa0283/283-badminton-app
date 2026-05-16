import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { permissions, UserRole } from "@/lib/permissions";
import { z } from "zod";

const updateSchema = z.object({
  status: z.enum(["attending", "not_attending"]).optional(),
  paymentStatus: z.enum(["paid", "unpaid"]).nullable().optional(),
  paymentAmount: z.number().int().nonnegative().nullable().optional(),
  paymentNote: z.string().max(500).nullable().optional(),
});

interface Params {
  params: Promise<{ eventId: string; attendanceId: string }>;
}

// PUT /api/events/[eventId]/attendances/[attendanceId]
// admin が attendance の status / 支払情報 を更新する。過去イベント・締切後でも可。
export async function PUT(request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ success: false, error: { code: "UNAUTHORIZED" } }, { status: 401 });
  }
  const role = session.user.role as UserRole;
  if (!permissions.canAccessAdmin(role)) {
    return NextResponse.json({ success: false, error: { code: "FORBIDDEN" } }, { status: 403 });
  }

  const { eventId, attendanceId } = await params;
  const body = await request.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message } },
      { status: 400 }
    );
  }

  const existing = await prisma.attendance.findUnique({ where: { id: attendanceId } });
  if (!existing || existing.eventId !== eventId) {
    return NextResponse.json({ success: false, error: { code: "NOT_FOUND" } }, { status: 404 });
  }

  const data: Record<string, unknown> = {};
  if (parsed.data.status !== undefined) {
    data.status = parsed.data.status;
    // attending / not_attending に変更したら waitlist のポジションは外す
    data.position = null;
  }
  if (parsed.data.paymentStatus !== undefined) data.paymentStatus = parsed.data.paymentStatus;
  if (parsed.data.paymentAmount !== undefined) data.paymentAmount = parsed.data.paymentAmount;
  if (parsed.data.paymentNote !== undefined) data.paymentNote = parsed.data.paymentNote;

  const updated = await prisma.attendance.update({
    where: { id: attendanceId },
    data,
  });

  // 出欠ステータスを変更した場合のみ履歴を残す
  if (parsed.data.status !== undefined && parsed.data.status !== existing.status) {
    await prisma.attendanceHistory.create({
      data: {
        userId: existing.userId,
        eventId,
        status: parsed.data.status,
        isProxy: true,
      },
    });
  }

  return NextResponse.json({ success: true, data: updated });
}
