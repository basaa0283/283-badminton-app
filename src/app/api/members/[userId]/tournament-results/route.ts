import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { permissions, UserRole } from "@/lib/permissions";

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
    // approved な大会の成績だけを返す。pending / rejected な大会は本人にも
    // ここでは出さない (大会詳細ページ側で見られる前提)。
    const results = await prisma.tournamentResult.findMany({
      where: { userId, tournament: { approvalStatus: "approved" } },
      include: {
        tournament: {
          select: {
            id: true,
            name: true,
            heldAt: true,
            tier: true,
            format: true,
            location: true,
          },
        },
        tournamentClass: {
          select: { id: true, gender: true, name: true, order: true },
        },
      },
      orderBy: { tournament: { heldAt: "desc" } },
    });

    return NextResponse.json({ success: true, data: results });
  } catch (error) {
    console.error("Member tournament-results GET error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: String(error) } },
      { status: 500 }
    );
  }
}
