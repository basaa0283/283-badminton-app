import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateProfileSchema } from "@/lib/validations";

// GET /api/profile - 自分のプロフィール取得
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "ログインが必要です" } },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        nickname: true,
        firstName: true,
        lastName: true,
        gender: true,
        age: true,
        ageVisible: true,
        profileImageUrl: true,
        comment: true,
        role: true,
        createdAt: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "ユーザーが見つかりません" } },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: user });
  } catch (error) {
    console.error("Profile GET error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "サーバーエラーが発生しました" } },
      { status: 500 }
    );
  }
}

// PUT /api/profile - 自分のプロフィール更新
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "ログインが必要です" } },
        { status: 401 }
      );
    }

    const body = await request.json();
    const parsed = updateProfileSchema.safeParse(body);

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

    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        nickname: parsed.data.nickname,
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        gender: parsed.data.gender,
        age: parsed.data.age,
        ageVisible: parsed.data.ageVisible,
        comment: parsed.data.comment,
      },
      select: {
        id: true,
        nickname: true,
        firstName: true,
        lastName: true,
        gender: true,
        age: true,
        ageVisible: true,
        profileImageUrl: true,
        comment: true,
        role: true,
      },
    });

    return NextResponse.json({ success: true, data: user });
  } catch (error) {
    console.error("Profile PUT error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "サーバーエラーが発生しました" } },
      { status: 500 }
    );
  }
}
