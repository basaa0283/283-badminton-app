import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@/lib/permissions";
import { isVisibleTo, isEventAnnouncementVisibleTo } from "@/lib/announcement";
import { logActivity } from "@/lib/activity-log";
import { tenantWhere } from "@/lib/tenant";

// GET /api/announcements - 自分の role に届いている公開中お知らせ + 既読状態
// イベント紐付き (eventId != null) のお知らせは Attendance ステータスでさらに絞り込む
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ success: false, error: { code: "UNAUTHORIZED" } }, { status: 401 });
  }
  const role = session.user.role as UserRole;
  const userId = session.user.id;

  const tw = await tenantWhere();
  const all = await prisma.announcement.findMany({
    where: { publishedAt: { lte: new Date() }, AND: [tw] },
    orderBy: { publishedAt: "desc" },
    take: 100,
    include: {
      createdBy: { select: { nickname: true } },
      reads: { where: { userId }, select: { readAt: true } },
      event: {
        select: {
          id: true,
          title: true,
          eventDate: true,
          attendances: {
            where: { userId },
            select: { status: true },
          },
        },
      },
    },
  });

  const visible = all
    .filter((a) => isVisibleTo(role, a))
    .filter((a) => {
      const attendance = a.event?.attendances[0]?.status ?? null;
      return isEventAnnouncementVisibleTo(role, a, attendance);
    })
    .map((a) => ({
      id: a.id,
      title: a.title,
      body: a.body,
      audienceMember: a.audienceMember,
      audienceVisitor: a.audienceVisitor,
      audienceGuest: a.audienceGuest,
      severity: a.severity,
      publishedAt: a.publishedAt,
      createdBy: a.createdBy?.nickname ?? null,
      read: a.reads.length > 0,
      // イベント紐付きなら関連イベントの ID・タイトル・日時を返す (バナーからリンクさせる用)
      event: a.event
        ? { id: a.event.id, title: a.event.title, eventDate: a.event.eventDate }
        : null,
    }));

  void logActivity({
    userId,
    action: "announcement.list_view",
    metadata: { visibleCount: visible.length },
  });

  return NextResponse.json({ success: true, data: visible });
}
