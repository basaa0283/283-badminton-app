import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  requirePlatformAdmin,
  RESERVED_SLUGS,
  SLUG_PATTERN,
  TENANT_PLANS,
} from "@/lib/platform-admin";
import { logActivity } from "@/lib/activity-log";

// POST /api/platform/tenants - テナント直接作成 (申請を経ない知人パイロット用)
export async function POST(request: NextRequest) {
  const auth = await requirePlatformAdmin();
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const slug = typeof body?.slug === "string" ? body.slug.trim().toLowerCase() : "";
    const plan = typeof body?.plan === "string" ? body.plan : "complimentary";

    if (!name || name.length > 100) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "サークル名は必須です (100文字以内)" } },
        { status: 400 },
      );
    }
    if (!SLUG_PATTERN.test(slug)) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "slug は英小文字・数字・ハイフンで 3〜30 文字です" } },
        { status: 400 },
      );
    }
    if (RESERVED_SLUGS.has(slug)) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "この slug は予約語のため使えません" } },
        { status: 400 },
      );
    }
    if (!TENANT_PLANS.has(plan)) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "プランが不正です" } },
        { status: 400 },
      );
    }
    const existing = await prisma.tenant.findUnique({ where: { slug } });
    if (existing) {
      return NextResponse.json(
        { success: false, error: { code: "CONFLICT", message: "この slug は既に使われています" } },
        { status: 409 },
      );
    }

    const tenant = await prisma.tenant.create({
      data: { slug, name, plan, status: "active" },
    });
    void logActivity({
      userId: auth.userId,
      action: "platform.tenant_create",
      entityType: "Tenant",
      entityId: tenant.id,
      metadata: { slug, name, plan },
    });
    return NextResponse.json({ success: true, data: tenant }, { status: 201 });
  } catch (error) {
    console.error("platform tenants POST error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "サーバーエラーが発生しました" } },
      { status: 500 },
    );
  }
}
