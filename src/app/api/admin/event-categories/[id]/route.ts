import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { permissions, UserRole } from "@/lib/permissions";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "色は #RRGGBB 形式").nullable().optional(),
  order: z.number().int().optional(),
  visibleToGuest: z.boolean().optional(),
});

interface Params {
  params: Promise<{ id: string }>;
}

// PATCH /api/admin/event-categories/[id]
export async function PATCH(request: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ success: false, error: { code: "UNAUTHORIZED" } }, { status: 401 });
  }
  const role = session.user.role as UserRole;
  if (!permissions.canAccessAdmin(role)) {
    return NextResponse.json({ success: false, error: { code: "FORBIDDEN" } }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message } },
      { status: 400 }
    );
  }

  try {
    const updated = await prisma.eventCategory.update({
      where: { id },
      data: parsed.data,
    });
    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    const code = (error as { code?: string })?.code;
    if (code === "P2002") {
      return NextResponse.json({ success: false, error: { code: "DUPLICATE", message: "同名の種別が既に存在します" } }, { status: 409 });
    }
    return NextResponse.json({ success: false, error: { code: "NOT_FOUND" } }, { status: 404 });
  }
}

// DELETE /api/admin/event-categories/[id] - 関連イベントは categoryId が null になる
export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ success: false, error: { code: "UNAUTHORIZED" } }, { status: 401 });
  }
  const role = session.user.role as UserRole;
  if (!permissions.canAccessAdmin(role)) {
    return NextResponse.json({ success: false, error: { code: "FORBIDDEN" } }, { status: 403 });
  }

  const { id } = await params;
  // 関連イベントの categoryId を先に null に (SQL Server NoAction 対応)
  await prisma.event.updateMany({ where: { categoryId: id }, data: { categoryId: null } });
  await prisma.eventCategory.delete({ where: { id } }).catch(() => null);
  return NextResponse.json({ success: true });
}
