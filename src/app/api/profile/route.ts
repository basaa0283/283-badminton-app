import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateProfileSchema } from "@/lib/validations";
import { computeAge } from "@/lib/age";
import { logActivity } from "@/lib/activity-log";

const PROFILE_SELECT = {
  id: true,
  nickname: true,
  firstName: true,
  lastName: true,
  gender: true,
  birthdate: true,
  ageVisible: true,
  profileImageUrl: true,
  comment: true,
  role: true,
  tournamentResultsPublic: true,
  // メール通知 (任意登録)
  notifyEmail: true,
  notifyEmailVerifiedAt: true,
  notifyOnNewEvent: true,
  notifyOnAnnouncement: true,
  notifyOnReminder: true,
  notifyOnEventMessage: true,
  createdAt: true,
} as const;

function withAge<T extends { birthdate: Date | null }>(user: T) {
  return { ...user, age: computeAge(user.birthdate) };
}

// GET /api/profile - 自分のプロフィール取得
// ?fromPage=1 を付けた呼び出しのみ profile.view を記録する。
// (ProfileCompletionBanner など回遊チェック系の呼び出しでログが肥大化するのを避けるため)
export async function GET(request: NextRequest) {
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
      select: PROFILE_SELECT,
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "ユーザーが見つかりません" } },
        { status: 404 }
      );
    }

    if (request.nextUrl.searchParams.get("fromPage") === "1") {
      void logActivity({
        userId: session.user.id,
        action: "profile.view",
      });
    }

    return NextResponse.json({ success: true, data: withAge(user) });
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
        birthdate: parsed.data.birthdate ? new Date(parsed.data.birthdate) : null,
        ageVisible: parsed.data.ageVisible,
        comment: parsed.data.comment,
        ...(parsed.data.tournamentResultsPublic !== undefined && {
          tournamentResultsPublic: parsed.data.tournamentResultsPublic,
        }),
      },
      select: PROFILE_SELECT,
    });

    void logActivity({
      userId: session.user.id,
      action: "profile.self_update",
      entityType: "User",
      entityId: session.user.id,
    });

    return NextResponse.json({ success: true, data: withAge(user) });
  } catch (error) {
    console.error("Profile PUT error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "サーバーエラーが発生しました" } },
      { status: 500 }
    );
  }
}
