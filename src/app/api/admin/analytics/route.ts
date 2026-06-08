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

    // 日別アクティブユーザー: その日に何らかの操作 or 閲覧があった unique user。
    // NextAuth は JWT セッション 30 日有効のため、auth.login だけだと実利用感が出ない。
    const activeByDay = new Map<string, Set<string>>();
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

    // 閲覧系 action の日別集計 + 累計集計
    const TRACKED_VIEWS = [
      "home.view",
      "event.list_view",
      "event.view",
      "tournament.list_view",
      "tournament.view",
      "member.view",
      "profile.view",
      "announcement.list_view",
      "about.view",
      "release_notes.view",
    ] as const;
    const VIEW_LABEL: Record<(typeof TRACKED_VIEWS)[number], string> = {
      "home.view": "ホーム",
      "event.list_view": "イベント一覧",
      "event.view": "イベント詳細",
      "tournament.list_view": "大会一覧",
      "tournament.view": "大会詳細",
      "member.view": "メンバー詳細",
      "profile.view": "プロフィール (自分)",
      "announcement.list_view": "お知らせ一覧",
      "about.view": "サークルについて",
      "release_notes.view": "更新履歴",
    };
    const viewSet = new Set<string>(TRACKED_VIEWS);
    const viewByDay = new Map<string, number>(); // 全view合算 (日別)
    const viewTotalByAction = new Map<string, number>(); // action別累計 (30日)
    const viewTotalByActionLast7 = new Map<string, number>(); // action別累計 (7日)

    const active7 = new Set<string>();
    const active30 = new Set<string>();

    for (const log of recentLogs) {
      const key = jstKey(log.createdAt);
      if (log.userId) {
        active30.add(log.userId);
        if (log.createdAt >= since7) active7.add(log.userId);
        if (!activeByDay.has(key)) activeByDay.set(key, new Set());
        activeByDay.get(key)!.add(log.userId);
      }
      const bucket = actionByDay[log.action];
      if (bucket) {
        bucket.set(key, (bucket.get(key) ?? 0) + 1);
      }
      if (viewSet.has(log.action)) {
        viewByDay.set(key, (viewByDay.get(key) ?? 0) + 1);
        viewTotalByAction.set(
          log.action,
          (viewTotalByAction.get(log.action) ?? 0) + 1,
        );
        if (log.createdAt >= since7) {
          viewTotalByActionLast7.set(
            log.action,
            (viewTotalByActionLast7.get(log.action) ?? 0) + 1,
          );
        }
      }
    }

    const accessByDay = days.map((day) => ({
      day,
      activeUsers: activeByDay.get(day)?.size ?? 0,
    }));

    const actionsByDay = days.map((day) => {
      const row: Record<string, number | string> = { day };
      for (const a of TRACKED_ACTIONS) {
        row[a] = actionByDay[a].get(day) ?? 0;
      }
      return row;
    });

    const viewsByDay = days.map((day) => ({
      day,
      pv: viewByDay.get(day) ?? 0,
    }));

    const viewsByPage = (TRACKED_VIEWS as readonly string[])
      .map((action) => ({
        action,
        label: VIEW_LABEL[action as keyof typeof VIEW_LABEL] ?? action,
        last30: viewTotalByAction.get(action) ?? 0,
        last7: viewTotalByActionLast7.get(action) ?? 0,
      }))
      .sort((a, b) => b.last30 - a.last30);

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
        viewsByDay,
        viewsByPage,
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
