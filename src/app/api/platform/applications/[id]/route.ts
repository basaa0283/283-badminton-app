import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  requirePlatformAdmin,
  RESERVED_SLUGS,
  SLUG_PATTERN,
} from "@/lib/platform-admin";
import { logActivity } from "@/lib/activity-log";

interface Params {
  params: Promise<{ id: string }>;
}

// PATCH /api/platform/applications/[id] - 申請の承認 / 却下
// 承認時は Tenant を作成する (plan は complimentary で開始、課金開始時に paid へ切替)。
export async function PATCH(request: NextRequest, { params }: Params) {
  const auth = await requirePlatformAdmin();
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;
    const body = await request.json();
    const action = body?.action as string | undefined;
    const resultNote = typeof body?.resultNote === "string" ? body.resultNote : null;

    if (action !== "approve" && action !== "reject") {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "action は approve か reject です" } },
        { status: 400 },
      );
    }

    const app = await prisma.tenantApplication.findUnique({ where: { id } });
    if (!app) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND" } },
        { status: 404 },
      );
    }
    if (app.status !== "pending") {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_STATE", message: "処理済みの申請です" } },
        { status: 400 },
      );
    }

    if (action === "reject") {
      const updated = await prisma.tenantApplication.update({
        where: { id },
        data: { status: "rejected", processedAt: new Date(), resultNote },
      });
      void logActivity({
        userId: auth.userId,
        action: "platform.application_reject",
        entityType: "TenantApplication",
        entityId: id,
        metadata: { circleName: app.circleName },
      });
      return NextResponse.json({ success: true, data: updated });
    }

    // approve: slug を確定して Tenant を作成
    const slug = (
      typeof body?.slug === "string" ? body.slug : app.desiredSlug ?? ""
    )
      .trim()
      .toLowerCase();
    if (!SLUG_PATTERN.test(slug) || RESERVED_SLUGS.has(slug)) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "slug が不正です (希望 slug が無い場合は body.slug で指定)" } },
        { status: 400 },
      );
    }
    const dup = await prisma.tenant.findUnique({ where: { slug } });
    if (dup) {
      return NextResponse.json(
        { success: false, error: { code: "CONFLICT", message: "この slug は既に使われています" } },
        { status: 409 },
      );
    }

    const [tenant, updated] = await prisma.$transaction([
      prisma.tenant.create({
        data: { slug, name: app.circleName, plan: "complimentary", status: "active" },
      }),
      prisma.tenantApplication.update({
        where: { id },
        data: { status: "approved", processedAt: new Date(), resultNote },
      }),
    ]);
    void logActivity({
      userId: auth.userId,
      action: "platform.application_approve",
      entityType: "Tenant",
      entityId: tenant.id,
      metadata: { applicationId: id, slug, circleName: app.circleName },
    });
    return NextResponse.json({ success: true, data: { tenant, application: updated } });
  } catch (error) {
    console.error("platform application PATCH error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "サーバーエラーが発生しました" } },
      { status: 500 },
    );
  }
}
