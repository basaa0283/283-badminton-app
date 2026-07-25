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
export async function GET(request: NextRequest, { params }: Params) {
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
    // preview=1 のときは「他人視点」を強制 (= isSelf / isAdmin を無効化する)
    const url = new URL(request.url);
    const previewMode = url.searchParams.get("preview") === "1";
    const isSelf = !previewMode && session.user.id === userId;
    const effectivelyAdmin = !previewMode && isAdmin;

    // 大会成績ごとに isPublic で公開制御する。
    //   本人 / admin: 全件
    //   他人: isPublic=true なものだけ
    const where =
      effectivelyAdmin || isSelf
        ? { userId, tournament: { approvalStatus: "approved" } }
        : { userId, tournament: { approvalStatus: "approved" }, isPublic: true };

    const results = await prisma.tournamentResult.findMany({
      where,
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

    // 他人視点で 0 件のとき: 「全件非公開」と「そもそも登録ゼロ」を meta で区別する。
    if (!effectivelyAdmin && !isSelf && results.length === 0) {
      const totalCount = await prisma.tournamentResult.count({
        where: { userId, tournament: { approvalStatus: "approved" } },
      });
      if (totalCount > 0) {
        return NextResponse.json({
          success: true,
          data: [],
          meta: { hidden: true, reason: "all_private" },
        });
      }
    }

    return NextResponse.json({ success: true, data: results });
  } catch (error) {
    console.error("Member tournament-results GET error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "サーバーエラーが発生しました" } },
      { status: 500 }
    );
  }
}
