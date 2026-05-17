import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { permissions, UserRole } from "@/lib/permissions";
import { z } from "zod";

const DEFAULT_CATEGORIES = [
  { name: "通常練習", color: "#3B82F6", order: 10 }, // blue
  { name: "シングル練", color: "#8B5CF6", order: 20 }, // violet
  { name: "基礎練", color: "#10B981", order: 30 }, // emerald
  { name: "大会", color: "#EF4444", order: 40 }, // red
  { name: "飲み会", color: "#F59E0B", order: 50 }, // amber
];

const createSchema = z.object({
  name: z.string().min(1, "名称は必須です").max(50, "名称は50文字以内"),
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

// POST /api/admin/event-categories - 新規追加。body が空なら初期5種を一括投入。
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ success: false, error: { code: "UNAUTHORIZED" } }, { status: 401 });
  }
  const role = session.user.role as UserRole;
  if (!permissions.canAccessAdmin(role)) {
    return NextResponse.json({ success: false, error: { code: "FORBIDDEN" } }, { status: 403 });
  }

  // body が無い (= 初期データ投入) リクエストかをチェック
  const raw = await request.text();
  if (!raw.trim()) {
    const existing = await prisma.eventCategory.findMany({ select: { name: true } });
    const existingNames = new Set(existing.map((c) => c.name));
    const toCreate = DEFAULT_CATEGORIES.filter((c) => !existingNames.has(c.name));
    if (toCreate.length === 0) {
      return NextResponse.json({ success: true, data: [], message: "既に登録済み" });
    }
    const created = await prisma.$transaction(
      toCreate.map((c) => prisma.eventCategory.create({ data: c }))
    );
    return NextResponse.json({ success: true, data: created }, { status: 201 });
  }

  const body = JSON.parse(raw);
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
