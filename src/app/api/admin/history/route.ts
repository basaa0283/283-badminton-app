import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { permissions, UserRole } from "@/lib/permissions";

// GET /api/admin/history - 履歴一覧取得
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "ログインが必要です" } },
        { status: 401 }
      );
    }

    const role = session.user.role as UserRole;
    if (!permissions.canAccessAdmin(role)) {
      return NextResponse.json(
        { success: false, error: { code: "FORBIDDEN", message: "権限がありません" } },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "login"; // login | attendance
    const userId = searchParams.get("userId");
    const eventId = searchParams.get("eventId");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    if (type === "login") {
      // ログイン履歴（最終操作日時を持つユーザー一覧）
      const where = userId ? { id: userId } : {};

      const users = await prisma.user.findMany({
        where,
        select: {
          id: true,
          nickname: true,
          profileImageUrl: true,
          role: true,
          lastActiveAt: true,
          createdAt: true,
        },
        orderBy: { lastActiveAt: { sort: "desc", nulls: "last" } },
        take: limit,
        skip: offset,
      });

      const total = await prisma.user.count({ where });

      return NextResponse.json({
        success: true,
        data: {
          users,
          total,
          hasMore: offset + users.length < total,
        },
      });
    } else if (type === "attendance") {
      // 出欠回答履歴
      const where: {
        userId?: string;
        eventId?: string;
      } = {};
      if (userId) where.userId = userId;
      if (eventId) where.eventId = eventId;

      const histories = await prisma.attendanceHistory.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              nickname: true,
              profileImageUrl: true,
              role: true,
            },
          },
          event: {
            select: {
              id: true,
              title: true,
              eventDate: true,
            },
          },
        },
        orderBy: { changedAt: "desc" },
        take: limit,
        skip: offset,
      });

      const total = await prisma.attendanceHistory.count({ where });

      return NextResponse.json({
        success: true,
        data: {
          histories,
          total,
          hasMore: offset + histories.length < total,
        },
      });
    } else {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_TYPE", message: "無効なタイプです" } },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("History GET error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "サーバーエラーが発生しました" } },
      { status: 500 }
    );
  }
}
