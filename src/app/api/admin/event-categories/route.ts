import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { permissions, UserRole } from "@/lib/permissions";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1, "名称は必須です").max(50, "名称は50文字以内"),
  description: z.string().max(500, "説明は500文字以内").optional().nullable(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "色は #RRGGBB 形式")
    .optional()
    .nullable(),
  order: z.number().int().optional(),
});

// GET /api/admin/event-categories - admin 用 (管理ページが使う)
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ success: false, error: { code: "UNAUTHORIZED" } }, { status: 401 });
  }
  const role = session.user.role as UserRole;
  if (!permissions.canAccessAdmin(role)) {
    return NextResponse.json({ success: false, error: { code: "FORBIDDEN" } }, { status: 403 });
  }
  const categories = await prisma.eventCategory.findMany({
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
  });
  return NextResponse.json({ success: true, data: categories });
}

// POST /api/admin/event-categories - 新規追加
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

  // 既存の最大 order +10 を新規 order に
  const maxOrder = await prisma.eventCategory.aggregate({ _max: { order: true } });
  const order = parsed.data.order ?? (maxOrder._max.order ?? 0) + 10;
  try {
    const created = await prisma.eventCategory.create({
      data: {
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        color: parsed.data.color ?? null,
        order,
      },
    });
    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error) {
    const msg = (error as { code?: string })?.code === "P2002" ? "同名の種別が既に存在します" : "登録に失敗しました";
    return NextResponse.json({ success: false, error: { code: "DUPLICATE", message: msg } }, { status: 409 });
  }
}
