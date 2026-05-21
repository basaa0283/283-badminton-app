import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { permissions, UserRole } from "@/lib/permissions";
import { tierRankScore } from "@/lib/tournament-meta";

interface Params {
  params: Promise<{ userId: string }>;
}

// GET /api/members/[userId]/tournament-results
// 指定ユーザーの大会成績を、大会情報を含めた形で新しい順に返す。
// member 以上のみ。
export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED" } },
        { status: 401 }
      );
    }
    const role = session.user.role as UserRole;
    if (!permissions.canViewTournaments(role)) {
      return NextResponse.json(
        { success: false, error: { code: "FORBIDDEN" } },
        { status: 403 }
      );
    }

    const { userId } = await params;
    const isAdmin = permissions.canAccessAdmin(role);
    const isSelf = session.user.id === userId;

    // 大会実績の全体公開スイッチ: OFF なら他メンバーには一切返さない (admin / 本人は例外)
    if (!isAdmin && !isSelf) {
      const owner = await prisma.user.findUnique({
        where: { id: userId },
        select: { tournamentResultsPublic: true },
      });
      if (!owner || !owner.tournamentResultsPublic) {
        return NextResponse.json({ success: true, data: [] });
      }
    }

    // approved な大会の成績だけを返す。
    const all = await prisma.tournamentResult.findMany({
      where: {
        userId,
        tournament: { approvalStatus: "approved" },
      },
      include: {
        tournament: {
          select: {
            id: true,
            name: true,
            heldAt: true,
            openness: true,
            prefecture: true,
            format: true,
            location: true,
          },
        },
        tournamentClass: {
          select: { id: true, category: true, name: true, tier: true, order: true },
        },
      },
      orderBy: { tournament: { heldAt: "desc" } },
    });

    // 他人ビュー (本人 / admin 以外) には「Tier × 順位」スコアが高い順で上位 5 件のみ返す。
    // 公開ルール: tournamentResultsPublic=true なユーザーについて、
    // 自動で上位 5 件が選出される (個別の公開フラグはなし)。
    if (!isAdmin && !isSelf) {
      const ranked = [...all].sort(
        (a, b) =>
          tierRankScore(a.tournamentClass?.tier, a.rank) -
          tierRankScore(b.tournamentClass?.tier, b.rank)
      );
      return NextResponse.json({ success: true, data: ranked.slice(0, 5) });
    }

    return NextResponse.json({ success: true, data: all });
  } catch (error) {
    console.error("Member tournament-results GET error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: String(error) } },
      { status: 500 }
    );
  }
}
