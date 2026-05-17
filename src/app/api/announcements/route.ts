import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@/lib/permissions";
import { isAudienceMatch } from "@/lib/announcement";

// GET /api/announcements - 認証ユーザー向け公開中お知らせ
// 自 role の audience に合致 + publishedAt <= now のもののみ
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ success: false, error: { code: "UNAUTHORIZED" } }, { status: 401 });
  }
  const role = session.user.role as UserRole;

  const all = await prisma.announcement.findMany({
    where: { publishedAt: { lte: new Date() } },
    orderBy: { publishedAt: "desc" },
    take: 50,
    include: {
      createdBy: { select: { nickname: true } },
    },
  });

  const visible = all
    .filter((a) => isAudienceMatch(role, a.audience))
    .map((a) => ({
      id: a.id,
      title: a.title,
      body: a.body,
      audience: a.audience,
      severity: a.severity,
      publishedAt: a.publishedAt,
      createdBy: a.createdBy?.nickname ?? null,
    }));

  return NextResponse.json({ success: true, data: visible });
}
