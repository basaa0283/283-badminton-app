import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { permissions, UserRole } from "@/lib/permissions";
import { tenantWhere } from "@/lib/tenant";

interface Params {
  params: Promise<{ id: string }>;
}

// DELETE /api/admin/shuttle-prices/[id] - 単価削除
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
  const tw = await tenantWhere();
  const existing = await prisma.shuttlePrice.findFirst({ where: { id, AND: [tw] } });
  if (!existing) {
    return NextResponse.json({ success: false, error: { code: "NOT_FOUND" } }, { status: 404 });
  }
  await prisma.shuttlePrice.delete({ where: { id } }).catch(() => null);
  return NextResponse.json({ success: true });
}
