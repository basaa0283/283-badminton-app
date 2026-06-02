import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { permissions, UserRole } from "@/lib/permissions";

// GET /api/admin/analytics
// 管理画面ダッシュボード用の集計データ。直近 30 日分の日別系列と
// アクティブユーザー数、お知らせ既読率を一括で返す。
//
// ActivityLog から集計するので、ログ蓄積が始まってから意味のある値が出る。
export async function GET() {
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

    const now = new Date();
    const since30 = new Date(now);
    since30.setUTCDate(since30.getUTCDate() - 29); // 直近 30 日 (今日込み)
    since30.setUTCHours(0, 0, 0, 0);
    const since7 = new Date(now);
    since7.setUTCDate(since7.getUTCDate() - 6);
    since7.setUTCHours(0, 0, 0, 0);

    const recentLogs = await prisma.activityLog.findMany({
      where: { createdAt: { gte: since30 } },
      select: { userId: true, action: true, createdAt: true },
    });

    // 日付ごとに集約するため、JST (UTC+9) ベースの YYYY-MM-DD キーに揃える。
    // (JST 0 時で日付が変わる感覚に合わせる)
    const jstKey = (d: Date) => {
      const jst = new Date(d.getTime() + 9 * 3600 * 1000);
      return jst.toISOString().slice(0, 10);
    };
    const days: string[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setUTCDate(d.getUTCDate() - i);
      days.push(jstKey(d));
    }

    // 日別ログイン unique user
    const loginByDay = new Map<string, Set<string>>();
    // 主要操作件数 (action 単位、日別)
    const TRACKED_ACTIONS = [
      "event.create",
      "attendance.update",
      "tournament.create",
      "tournament_result.create",
      "announcement.create",
    ] as const;
    const actionByDay: Record<string, Map<string, number>> = {};
    for (const a of TRACKED_ACTIONS) actionByDay[a] = new Map();

    const active7 = new Set<string>();
    const active30 = new Set<string>();

    for (const log of recentLogs) {
      const key = jstKey(log.createdAt);
      if (log.userId) {
        active30.add(log.userId);
        if (log.createdAt >= since7) active7.add(log.userId);
        if (log.action === "auth.login") {
          if (!loginByDay.has(key)) loginByDay.set(key, new Set());
          loginByDay.get(key)!.add(log.userId);
        }
      }
      const bucket = actionByDay[log.action];
      if (bucket) {
        bucket.set(key, (bucket.get(key) ?? 0) + 1);
      }
    }

    const accessByDay = days.map((day) => ({
      day,
      logins: loginByDay.get(day)?.size ?? 0,
    }));

    const actionsByDay = days.map((day) => {
      const row: Record<string, number | string> = { day };
      for (const a of TRACKED_ACTIONS) {
        row[a] = actionByDay[a].get(day) ?? 0;
      }
      return row;
    });

    // お知らせ既読率: publishedAt 降順、直近 20 件
    const announcements = await prisma.announcement.findMany({
      where: { publishedAt: { lte: now } },
      orderBy: { publishedAt: "desc" },
      take: 20,
      select: {
        id: true,
        title: true,
        publishedAt: true,
        audienceMember: true,
        audienceVisitor: true,
        audienceGuest: true,
        _count: { select: { reads: true } },
      },
    });

    const audienceCounts = await prisma.user.groupBy({
      by: ["role"],
      _count: { _all: true },
    });
    const memberCount =
      audienceCounts.find((r) => r.role === "member")?._count._all ?? 0;
    const visitorCount =
      audienceCounts.find((r) => r.role === "visitor")?._count._all ?? 0;
    const guestCount =
      audienceCounts.find((r) => r.role === "guest")?._count._all ?? 0;
    const adminCount =
      (audienceCounts.find((r) => r.role === "admin")?._count._all ?? 0) +
      (audienceCounts.find((r) => r.role === "subadmin")?._count._all ?? 0);

    const announcementsWithRate = announcements.map((a) => {
      const target =
        adminCount +
        (a.audienceMember ? memberCount : 0) +
        (a.audienceVisitor ? visitorCount : 0) +
        (a.audienceGuest ? guestCount : 0);
      const readCount = a._count.reads;
      return {
        id: a.id,
        title: a.title,
        publishedAt: a.publishedAt,
        readCount,
        targetCount: target,
        rate: target > 0 ? readCount / target : 0,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        accessByDay,
        actionsByDay,
        trackedActions: TRACKED_ACTIONS,
        activeUsers: {
          last7: active7.size,
          last30: active30.size,
        },
        announcements: announcementsWithRate,
      },
    });
  } catch (error) {
    console.error("Analytics GET error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: String(error) } },
      { status: 500 },
    );
  }
}
