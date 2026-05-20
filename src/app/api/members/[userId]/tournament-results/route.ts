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
    // approved な大会の成績だけを返す。
    // 公開フラグ: 本人と admin 以外には isPublic=true のみ返す。
    const isAdmin = permissions.canAccessAdmin(role);
    const isSelf = session.user.id === userId;
    const publicFilter = isAdmin || isSelf ? {} : { isPublic: true };
    const results = await prisma.tournamentResult.findMany({
      where: {
        userId,
        tournament: { approvalStatus: "approved" },
        ...publicFilter,
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

    return NextResponse.json({ success: true, data: results });
  } catch (error) {
    console.error("Member tournament-results GET error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: String(error) } },
      { status: 500 }
    );
  }
}
