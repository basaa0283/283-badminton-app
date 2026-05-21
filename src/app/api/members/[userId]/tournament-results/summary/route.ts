import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { permissions, UserRole } from "@/lib/permissions";
import { buildSummary } from "@/lib/tournament-summary";

interface Params {
  params: Promise<{ userId: string }>;
}

// GET /api/members/[userId]/tournament-results/summary
// 「種目 × Tier × メダル種別 (gold/silver/bronze)」の集計を返す。
// アクセス制御は実績一覧と同じ:
//   - 本人 / admin: 常に閲覧可
//   - 他人: User.tournamentResultsPublic = true のときのみ
// 集計対象は approved な大会の成績のうち、Tier 指定済みのもの。
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

    if (!isAdmin && !isSelf) {
      const owner = await prisma.user.findUnique({
        where: { id: userId },
        select: { tournamentResultsPublic: true },
      });
      if (!owner || !owner.tournamentResultsPublic) {
        return NextResponse.json({ success: true, data: {} });
      }
    }

    const results = await prisma.tournamentResult.findMany({
      where: {
        userId,
        tournament: { approvalStatus: "approved" },
      },
      select: {
        category: true,
        rank: true,
        tournamentClass: { select: { tier: true } },
      },
    });

    const summary = buildSummary(results);
    return NextResponse.json({ success: true, data: summary });
  } catch (error) {
    console.error("Tournament summary GET error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: String(error) } },
      { status: 500 }
    );
  }
}
