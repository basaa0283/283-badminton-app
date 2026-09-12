import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePlatformAdmin } from "@/lib/platform-admin";

// 有料プランの月額 (円)。設計 2026-09-04 の決定値
const PAID_PLAN_PRICE_JPY = 1000;

// GET /api/platform/overview
// プラットフォーム管理ダッシュボード用の一括取得 (テナント一覧 + 申請 + 統計)
export async function GET() {
  const auth = await requirePlatformAdmin();
  if (!auth.ok) return auth.response;

  try {
    const [tenants, applications] = await Promise.all([
      prisma.tenant.findMany({
        orderBy: { createdAt: "asc" },
        include: {
          _count: { select: { memberships: true } },
        },
      }),
      prisma.tenantApplication.findMany({
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
    ]);

    // テナント別のイベント数・直近30日のアクティビティ数 (利用状況の目安)
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [eventCounts, recentActivity] = await Promise.all([
      prisma.event.groupBy({
        by: ["tenantId"],
        _count: { id: true },
      }),
      prisma.activityLog.groupBy({
        by: ["tenantId"],
        where: { createdAt: { gte: since } },
        _count: { id: true },
      }),
    ]);
    const eventCountMap = new Map(
      eventCounts.map((e) => [e.tenantId ?? "", e._count.id]),
    );
    const activityMap = new Map(
      recentActivity.map((a) => [a.tenantId ?? "", a._count.id]),
    );

    const paidCount = tenants.filter(
      (t) => t.plan === "paid" && t.status === "active",
    ).length;

    return NextResponse.json({
      success: true,
      data: {
        stats: {
          totalTenants: tenants.length,
          activeTenants: tenants.filter((t) => t.status === "active").length,
          paidTenants: paidCount,
          complimentaryTenants: tenants.filter((t) => t.plan === "complimentary").length,
          mrr: paidCount * PAID_PLAN_PRICE_JPY,
          pendingApplications: applications.filter((a) => a.status === "pending").length,
        },
        tenants: tenants.map((t) => ({
          id: t.id,
          slug: t.slug,
          name: t.name,
          plan: t.plan,
          status: t.status,
          memberCount: t._count.memberships,
          eventCount: eventCountMap.get(t.id) ?? 0,
          recentActivityCount: activityMap.get(t.id) ?? 0,
          createdAt: t.createdAt,
        })),
        applications: applications.map((a) => ({
          id: a.id,
          circleName: a.circleName,
          desiredSlug: a.desiredSlug,
          contactName: a.contactName,
          contactInfo: a.contactInfo,
          note: a.note,
          status: a.status,
          processedAt: a.processedAt,
          resultNote: a.resultNote,
          createdAt: a.createdAt,
        })),
      },
    });
  } catch (error) {
    console.error("platform overview GET error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "サーバーエラーが発生しました" } },
      { status: 500 },
    );
  }
}
