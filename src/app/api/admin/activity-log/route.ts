import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { permissions, UserRole } from "@/lib/permissions";

// GET /api/admin/activity-log
// 管理者向けの操作ログ閲覧。
//   query:
//     - action: action の前方一致 (例: "tournament" で大会関連全部)
//     - userId: 操作者で絞り込み
//     - from / to: 期間 (YYYY-MM-DD)
//     - limit: 1 ページの最大件数 (デフォルト 100, 上限 500)
//     - offset: ページング用オフセット
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED" } },
        { status: 401 },
      );
    }
    const role = session.user.role as UserRole;
    if (!permissions.canAccessAdmin(role)) {
      return NextResponse.json(
        { success: false, error: { code: "FORBIDDEN" } },
        { status: 403 },
      );
    }

    const { searchParams } = new URL(request.url);
    const actionFilter = searchParams.get("action")?.trim() || undefined;
    const userIdFilter = searchParams.get("userId")?.trim() || undefined;
    const fromStr = searchParams.get("from")?.trim() || undefined;
    const toStr = searchParams.get("to")?.trim() || undefined;
    const limitParam = Number(searchParams.get("limit"));
    const offsetParam = Number(searchParams.get("offset"));
    const limit =
      Number.isFinite(limitParam) && limitParam > 0
        ? Math.min(limitParam, 500)
        : 100;
    const offset =
      Number.isFinite(offsetParam) && offsetParam > 0 ? offsetParam : 0;

    const where: {
      action?: { startsWith: string };
      userId?: string;
      createdAt?: { gte?: Date; lte?: Date };
    } = {};
    if (actionFilter) where.action = { startsWith: actionFilter };
    if (userIdFilter) where.userId = userIdFilter;
    if (fromStr) {
      where.createdAt = { ...(where.createdAt ?? {}), gte: new Date(`${fromStr}T00:00:00Z`) };
    }
    if (toStr) {
      where.createdAt = { ...(where.createdAt ?? {}), lte: new Date(`${toStr}T23:59:59Z`) };
    }

    const [total, logs] = await Promise.all([
      prisma.activityLog.count({ where }),
      prisma.activityLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: offset,
        take: limit,
        include: {
          user: { select: { id: true, nickname: true } },
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: logs.map((l) => ({
        id: l.id,
        createdAt: l.createdAt,
        action: l.action,
        entityType: l.entityType,
        entityId: l.entityId,
        metadata: l.metadata,
        user: l.user,
      })),
      pagination: {
        total,
        offset,
        limit,
        hasMore: offset + logs.length < total,
      },
    });
  } catch (error) {
    console.error("Activity log GET error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "サーバーエラーが発生しました" } },
      { status: 500 },
    );
  }
}
