import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const notifySettingsSchema = z.object({
  notifyOnNewEvent: z.boolean().optional(),
  notifyOnAnnouncement: z.boolean().optional(),
  notifyOnReminder: z.boolean().optional(),
  notifyOnEventMessage: z.boolean().optional(),
});

// PUT /api/profile/notify-settings - メール通知の種別スイッチ更新 (部分更新可)
// 確認済みアドレスがないユーザーは設定変更できない (400)。
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
    const parsed = notifySettingsSchema.safeParse(body);
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

    const current = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { notifyEmailVerifiedAt: true },
    });
    if (!current?.notifyEmailVerifiedAt) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "EMAIL_NOT_VERIFIED", message: "メールアドレスの確認が完了していません" },
        },
        { status: 400 }
      );
    }

    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: parsed.data,
      select: {
        notifyOnNewEvent: true,
        notifyOnAnnouncement: true,
        notifyOnReminder: true,
        notifyOnEventMessage: true,
      },
    });

    return NextResponse.json({ success: true, data: user });
  } catch (error) {
    console.error("Notify settings PUT error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "サーバーエラーが発生しました" } },
      { status: 500 }
    );
  }
}
