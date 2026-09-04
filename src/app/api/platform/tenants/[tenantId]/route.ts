import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  requirePlatformAdmin,
  TENANT_PLANS,
  TENANT_STATUSES,
} from "@/lib/platform-admin";
import { logActivity } from "@/lib/activity-log";
import { DEFAULT_TENANT_SLUG } from "@/lib/tenant";

interface Params {
  params: Promise<{ tenantId: string }>;
}

// PATCH /api/platform/tenants/[tenantId] - プラン / 状態の切替
export async function PATCH(request: NextRequest, { params }: Params) {
  const auth = await requirePlatformAdmin();
  if (!auth.ok) return auth.response;

  try {
    const { tenantId } = await params;
    const body = await request.json();
    const plan = body?.plan as string | undefined;
    const status = body?.status as string | undefined;

    if (plan === undefined && status === undefined) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "plan か status を指定してください" } },
        { status: 400 },
      );
    }
    if (plan !== undefined && !TENANT_PLANS.has(plan)) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "プランが不正です" } },
        { status: 400 },
      );
    }
    if (status !== undefined && !TENANT_STATUSES.has(status)) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "状態が不正です" } },
        { status: 400 },
      );
    }

    const existing = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND" } },
        { status: 404 },
      );
    }
    // 自サークル (283bad) の凍結は誤操作の可能性が極めて高いので拒否する
    if (existing.slug === DEFAULT_TENANT_SLUG && status === "frozen") {
      return NextResponse.json(
        { success: false, error: { code: "FORBIDDEN", message: "デフォルトテナント (283bad) は凍結できません" } },
        { status: 400 },
      );
    }

    const tenant = await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        ...(plan !== undefined ? { plan } : {}),
        ...(status !== undefined ? { status } : {}),
      },
    });
    void logActivity({
      userId: auth.userId,
      action: "platform.tenant_update",
      entityType: "Tenant",
      entityId: tenantId,
      metadata: {
        slug: existing.slug,
        before: { plan: existing.plan, status: existing.status },
        after: { plan: tenant.plan, status: tenant.status },
      },
    });
    return NextResponse.json({ success: true, data: tenant });
  } catch (error) {
    console.error("platform tenant PATCH error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "サーバーエラーが発生しました" } },
      { status: 500 },
    );
  }
}
