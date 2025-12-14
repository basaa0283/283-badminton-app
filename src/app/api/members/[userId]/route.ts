import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { permissions, UserRole } from "@/lib/permissions";
import { adminUpdateMemberSchema } from "@/lib/validations";

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
    const isAdmin = permissions.canAccessAdmin(role);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        nickname: true,
        firstName: true,
        lastName: true,
        profileImageUrl: true,
        role: true,
        gender: true,
        age: true,
        ageVisible: true,
        comment: true,
        lastActiveAt: true,
        skillLevel: true,
        adminNote: true,
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

    // 過去のイベント参加回数を取得（終了したイベントのみ）
    const pastAttendanceCount = await prisma.attendance.count({
      where: {
        userId: userId,
        status: "attending",
        event: {
          eventDate: { lt: new Date() },
        },
      },
    });

    // 管理者には全フィールド、一般ユーザーには制限されたフィールドを返す
    const responseData: Record<string, unknown> = {
      id: user.id,
      nickname: user.nickname,
      profileImageUrl: user.profileImageUrl,
      role: user.role,
      gender: user.gender,
      age: user.ageVisible ? user.age : null,
      ageVisible: user.ageVisible,
      comment: user.comment,
      lastActiveAt: user.lastActiveAt,
      createdAt: user.createdAt,
      attendanceCount: user._count.attendances,
      pastAttendanceCount,
    };

    // 管理者権限の場合、追加の管理者専用フィールドを含める
    if (isAdmin) {
      responseData.firstName = user.firstName;
      responseData.lastName = user.lastName;
      responseData.skillLevel = user.skillLevel;
      responseData.adminNote = user.adminNote;
      // 管理者には年齢を常に表示
      responseData.age = user.age;
    }

    return NextResponse.json({
      success: true,
      data: responseData,
    });
  } catch (error) {
    console.error("Member GET error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "サーバーエラーが発生しました" } },
      { status: 500 }
    );
  }
}

// PUT /api/members/[userId] - メンバー情報更新（管理者用）
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
    if (!permissions.canAccessAdmin(role)) {
      return NextResponse.json(
        { success: false, error: { code: "FORBIDDEN", message: "メンバー編集の権限がありません" } },
        { status: 403 }
      );
    }

    const { userId } = await params;
    const body = await request.json();
    const parsed = adminUpdateMemberSchema.safeParse(body);

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

    // 自分自身の権限は変更できない（権限変更の場合のみ）
    if (parsed.data.role && userId === session.user.id) {
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

    // 更新データを構築
    const updateData: Record<string, unknown> = {};
    if (parsed.data.nickname !== undefined) updateData.nickname = parsed.data.nickname;
    if (parsed.data.firstName !== undefined) updateData.firstName = parsed.data.firstName;
    if (parsed.data.lastName !== undefined) updateData.lastName = parsed.data.lastName;
    if (parsed.data.gender !== undefined) updateData.gender = parsed.data.gender;
    if (parsed.data.age !== undefined) updateData.age = parsed.data.age;
    if (parsed.data.ageVisible !== undefined) updateData.ageVisible = parsed.data.ageVisible;
    if (parsed.data.comment !== undefined) updateData.comment = parsed.data.comment;
    if (parsed.data.role !== undefined) updateData.role = parsed.data.role;
    if (parsed.data.skillLevel !== undefined) updateData.skillLevel = parsed.data.skillLevel;
    if (parsed.data.adminNote !== undefined) updateData.adminNote = parsed.data.adminNote;

    const user = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        nickname: true,
        firstName: true,
        lastName: true,
        profileImageUrl: true,
        role: true,
        gender: true,
        age: true,
        ageVisible: true,
        comment: true,
        skillLevel: true,
        adminNote: true,
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
