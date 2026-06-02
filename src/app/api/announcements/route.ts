import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@/lib/permissions";
import { isVisibleTo } from "@/lib/announcement";
import { logActivity } from "@/lib/activity-log";

// GET /api/announcements - 自分の role に届いている公開中お知らせ + 既読状態
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ success: false, error: { code: "UNAUTHORIZED" } }, { status: 401 });
  }
  const role = session.user.role as UserRole;
  const userId = session.user.id;

  const all = await prisma.announcement.findMany({
    where: { publishedAt: { lte: new Date() } },
    orderBy: { publishedAt: "desc" },
    take: 100,
    include: {
      createdBy: { select: { nickname: true } },
      reads: { where: { userId }, select: { readAt: true } },
    },
  });

  const visible = all
    .filter((a) => isVisibleTo(role, a))
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
    }));

  void logActivity({
    userId,
    action: "announcement.list_view",
    metadata: { visibleCount: visible.length },
  });

  return NextResponse.json({ success: true, data: visible });
}
