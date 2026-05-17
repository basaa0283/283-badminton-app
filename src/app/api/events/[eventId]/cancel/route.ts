import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { permissions, UserRole } from "@/lib/permissions";
import { z } from "zod";

const cancelSchema = z.object({
  reason: z.string().max(500).optional().nullable(),
});

interface Params {
  params: Promise<{ eventId: string }>;
}

// POST /api/events/[eventId]/cancel - イベントを中止 (admin/subadmin)
export async function POST(request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ success: false, error: { code: "UNAUTHORIZED" } }, { status: 401 });
  }
  const role = session.user.role as UserRole;
  if (!permissions.canEditEvent(role)) {
    return NextResponse.json({ success: false, error: { code: "FORBIDDEN" } }, { status: 403 });
  }

  const { eventId } = await params;
  const body = await request.json().catch(() => ({}));
  const parsed = cancelSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message } },
      { status: 400 }
    );
  }

  const event = await prisma.event.update({
    where: { id: eventId },
    data: {
      cancelledAt: new Date(),
      cancelReason: parsed.data.reason ?? null,
    },
  });
  return NextResponse.json({ success: true, data: event });
}

// DELETE /api/events/[eventId]/cancel - 中止を解除
export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ success: false, error: { code: "UNAUTHORIZED" } }, { status: 401 });
  }
  const role = session.user.role as UserRole;
  if (!permissions.canEditEvent(role)) {
    return NextResponse.json({ success: false, error: { code: "FORBIDDEN" } }, { status: 403 });
  }

  const { eventId } = await params;
  const event = await prisma.event.update({
    where: { id: eventId },
    data: { cancelledAt: null, cancelReason: null },
  });
  return NextResponse.json({ success: true, data: event });
}
