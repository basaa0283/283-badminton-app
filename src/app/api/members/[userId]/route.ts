import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { permissions, UserRole } from "@/lib/permissions";
import { updateMemberRoleSchema } from "@/lib/validations";

interface Params {
  params: Promise<{ userId: string }>;
}

// GET /api/members/[userId] - メンバー詳細取得
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "ログインが必要です" } },
        { status: 401 }
      );
    }

    const role = session.user.role as UserRole;
    if (!permissions.canViewMemberDetails(role)) {
      return NextResponse.json(
        { success: false, error: { code: "FORBIDDEN", message: "メンバー詳細の閲覧権限がありません" } },
        { status: 403 }
      );
    }

    const { userId } = await params;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        nickname: true,
        profileImageUrl: true,
        role: true,
        gender: true,
        age: true,
        ageVisible: true,
        comment: true,
        createdAt: true,
        _count: {
          select: {
            attendances: {
              where: { status: "attending" },
            },
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "メンバーが見つかりません" } },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        id: user.id,
        nickname: user.nickname,
        profileImageUrl: user.profileImageUrl,
        role: user.role,
        gender: user.gender,
        age: user.ageVisible ? user.age : null,
        ageVisible: user.ageVisible,
        comment: user.comment,
        createdAt: user.createdAt,
        attendanceCount: user._count.attendances,
      },
    });
  } catch (error) {
    console.error("Member GET error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "サーバーエラーが発生しました" } },
      { status: 500 }
    );
  }
}

// PUT /api/members/[userId] - メンバー権限更新
export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "ログインが必要です" } },
        { status: 401 }
      );
    }

    const role = session.user.role as UserRole;
    if (!permissions.canEditMemberRole(role)) {
      return NextResponse.json(
        { success: false, error: { code: "FORBIDDEN", message: "権限変更の権限がありません" } },
        { status: 403 }
      );
    }

    const { userId } = await params;
    const body = await request.json();
    const parsed = updateMemberRoleSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: parsed.error.issues[0]?.message || "入力内容に誤りがあります",
          },
        },
        { status: 400 }
      );
    }

    // 自分自身の権限は変更できない
    if (userId === session.user.id) {
      return NextResponse.json(
        { success: false, error: { code: "FORBIDDEN", message: "自分自身の権限は変更できません" } },
        { status: 403 }
      );
    }

    // admin権限への変更は admin のみ可能
    if (parsed.data.role === "admin" && role !== "admin") {
      return NextResponse.json(
        { success: false, error: { code: "FORBIDDEN", message: "管理者権限の付与は管理者のみ可能です" } },
        { status: 403 }
      );
    }

    const existing = await prisma.user.findUnique({ where: { id: userId } });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "メンバーが見つかりません" } },
        { status: 404 }
      );
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: { role: parsed.data.role },
      select: {
        id: true,
        nickname: true,
        role: true,
      },
    });

    return NextResponse.json({ success: true, data: user });
  } catch (error) {
    console.error("Member PUT error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "サーバーエラーが発生しました" } },
      { status: 500 }
    );
  }
}
