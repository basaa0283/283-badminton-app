import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { permissions, UserRole } from "@/lib/permissions";
import { getDefaultTenantId, tenantWhere } from "@/lib/tenant";
import { z } from "zod";

const updateSchema = z.object({
  status: z.enum(["attending", "not_attending", "observing"]).optional(),
  paymentStatus: z.enum(["paid", "unpaid"]).nullable().optional(),
  paymentAmount: z.number().int().nonnegative().nullable().optional(),
  paymentNote: z.string().max(500).nullable().optional(),
  declaredTournamentClassId: z.string().nullable().optional(),
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

  // Attendance は直接 id で取得するのでテナントチェックなし。ここで tenantWhere を挟む。
  const tw = await tenantWhere();
  const existing = await prisma.attendance.findFirst({
    where: { id: attendanceId, eventId, AND: [tw] },
  });
  if (!existing) {
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
  if (parsed.data.declaredTournamentClassId !== undefined) {
    data.declaredTournamentClassId = parsed.data.declaredTournamentClassId;
  }

  // 「受取済み」に切り替えた瞬間の event.fee を snapshot し、後で event.fee が
  // 変わっても受取金額が連動しないようにする。
  // 条件: paymentStatus が paid に変わった + リクエストで paymentAmount を明示していない
  //       + 既存の paymentAmount が null (未設定)
  const becomingPaid =
    parsed.data.paymentStatus === "paid" && existing.paymentStatus !== "paid";
  const amountNotProvided = parsed.data.paymentAmount === undefined;
  const noExistingAmount = existing.paymentAmount === null;
  if (becomingPaid && amountNotProvided && noExistingAmount) {
    const event = await prisma.event.findFirst({
      where: { id: eventId, AND: [tw] },
      select: { fee: true },
    });
    data.paymentAmount = event?.fee ?? 0;
  }

  const updated = await prisma.attendance.update({
    where: { id: attendanceId },
    data,
  });

  // 出欠ステータスを変更した場合のみ履歴を残す
  if (parsed.data.status !== undefined && parsed.data.status !== existing.status) {
    const tenantId = await getDefaultTenantId();
    await prisma.attendanceHistory.create({
      data: {
        userId: existing.userId,
        eventId,
        status: parsed.data.status,
        isProxy: true,
        tenantId,
      },
    });
  }

  return NextResponse.json({ success: true, data: updated });
}
