import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import crypto from "crypto";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-log";
import { sendVerificationEmail } from "@/lib/notify-email";

const notifyEmailSchema = z.object({
  email: z
    .email("有効なメールアドレスを入力してください")
    .max(254, "メールアドレスは254文字以内で入力してください"),
});

// 確認トークンの有効期限 (24時間)
const VERIFY_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

// PUT /api/profile/notify-email - 通知用メールアドレスの登録 (確認メール送信)
// 既存アドレスがある場合も上書きして未確認状態に戻す (再送にも使う)。
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
    const parsed = notifyEmailSchema.safeParse(body);
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

    const email = parsed.data.email.trim();
    const token = crypto.randomBytes(32).toString("hex");

    await prisma.$transaction([
      // 古い確認トークンは無効化 (unsubscribe トークンは残す)
      prisma.emailToken.deleteMany({
        where: { userId: session.user.id, purpose: "verify" },
      }),
      prisma.user.update({
        where: { id: session.user.id },
        data: { notifyEmail: email, notifyEmailVerifiedAt: null },
      }),
      prisma.emailToken.create({
        data: {
          token,
          userId: session.user.id,
          purpose: "verify",
          expiresAt: new Date(Date.now() + VERIFY_TOKEN_TTL_MS),
        },
      }),
    ]);

    const sent = await sendVerificationEmail(email, token);
    if (!sent) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "EMAIL_SEND_FAILED", message: "確認メールの送信に失敗しました。時間をおいて再度お試しください" },
        },
        { status: 500 }
      );
    }

    void logActivity({
      userId: session.user.id,
      action: "notify_email.register",
      entityType: "User",
      entityId: session.user.id,
    });

    return NextResponse.json({
      success: true,
      data: { notifyEmail: email, notifyEmailVerifiedAt: null },
    });
  } catch (error) {
    console.error("Notify email PUT error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "サーバーエラーが発生しました" } },
      { status: 500 }
    );
  }
}

// DELETE /api/profile/notify-email - 通知用メールアドレスの登録解除
export async function DELETE() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "ログインが必要です" } },
        { status: 401 }
      );
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: session.user.id },
        data: { notifyEmail: null, notifyEmailVerifiedAt: null },
      }),
      prisma.emailToken.deleteMany({ where: { userId: session.user.id } }),
    ]);

    void logActivity({
      userId: session.user.id,
      action: "notify_email.remove",
      entityType: "User",
      entityId: session.user.id,
    });

    return NextResponse.json({
      success: true,
      data: { notifyEmail: null, notifyEmailVerifiedAt: null },
    });
  } catch (error) {
    console.error("Notify email DELETE error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "サーバーエラーが発生しました" } },
      { status: 500 }
    );
  }
}
