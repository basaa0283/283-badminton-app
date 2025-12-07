import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { permissions, UserRole } from "@/lib/permissions";

// GET /api/members - メンバー一覧取得
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "ログインが必要です" } },
        { status: 401 }
      );
    }

    const role = session.user.role as UserRole;
    const canViewDetails = permissions.canViewMemberDetails(role);

    const users = await prisma.user.findMany({
      where: {
        role: { not: "guest" }, // ゲストは一覧に表示しない
      },
      orderBy: [{ role: "asc" }, { nickname: "asc" }],
      select: {
        id: true,
        nickname: true,
        profileImageUrl: true,
        role: true,
        gender: canViewDetails,
        age: canViewDetails,
        ageVisible: canViewDetails,
        comment: canViewDetails,
        createdAt: canViewDetails,
      },
    });

    const members = users.map((user) => {
      if (canViewDetails) {
        return {
          id: user.id,
          nickname: user.nickname,
          profileImageUrl: user.profileImageUrl,
          role: user.role,
          gender: user.gender,
          age: user.ageVisible ? user.age : null,
          ageVisible: user.ageVisible,
          comment: user.comment,
          createdAt: user.createdAt,
        };
      }
      return {
        id: user.id,
        nickname: user.nickname,
        profileImageUrl: user.profileImageUrl,
        role: user.role,
      };
    });

    return NextResponse.json({ success: true, data: members });
  } catch (error) {
    console.error("Members GET error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "サーバーエラーが発生しました" } },
      { status: 500 }
    );
  }
}
