import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { permissions, UserRole } from "@/lib/permissions";
import { getDefaultTenantId, tenantWhere } from "@/lib/tenant";
import { z } from "zod";

const createSchema = z.object({
  effectiveFrom: z.string().datetime("有効な日付を入力してください"),
  casePrice: z.number().int().positive("ケース価格は1以上で入力してください"),
  shuttlesPerCase: z.number().int().positive("ケース内個数は1以上で入力してください").default(120),
  memo: z.string().max(500).optional().nullable(),
});

// GET /api/admin/shuttle-prices - 単価履歴
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ success: false, error: { code: "UNAUTHORIZED" } }, { status: 401 });
  }
  const role = session.user.role as UserRole;
  if (!permissions.canAccessAdmin(role)) {
    return NextResponse.json({ success: false, error: { code: "FORBIDDEN" } }, { status: 403 });
  }

  const tw = await tenantWhere();
  const prices = await prisma.shuttlePrice.findMany({
    where: { AND: [tw] },
    orderBy: { effectiveFrom: "desc" },
  });
  return NextResponse.json({ success: true, data: prices });
}

// POST /api/admin/shuttle-prices - 単価追加
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ success: false, error: { code: "UNAUTHORIZED" } }, { status: 401 });
  }
  const role = session.user.role as UserRole;
  if (!permissions.canAccessAdmin(role)) {
    return NextResponse.json({ success: false, error: { code: "FORBIDDEN" } }, { status: 403 });
  }

  const body = await request.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message } },
      { status: 400 }
    );
  }

  const tenantId = await getDefaultTenantId();
  const created = await prisma.shuttlePrice.create({
    data: {
      effectiveFrom: new Date(parsed.data.effectiveFrom),
      casePrice: parsed.data.casePrice,
      shuttlesPerCase: parsed.data.shuttlesPerCase,
      memo: parsed.data.memo ?? null,
      tenantId,
    },
  });
  return NextResponse.json({ success: true, data: created }, { status: 201 });
}
