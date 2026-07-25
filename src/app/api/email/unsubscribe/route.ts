import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-log";

const unsubscribeSchema = z.object({
  token: z.string().min(1),
});

// POST /api/email/unsubscribe - 通知メールの配信停止リンクから呼ばれる (認証不要)。
// 4 つの通知スイッチをすべて OFF にする。アドレス・確認状態は消さない
// (プロフィール画面からいつでも再開できる)。
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = unsubscribeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "トークンが指定されていません" } },
        { status: 400 }
      );
    }

    const record = await prisma.emailToken.findUnique({
      where: { token: parsed.data.token },
    });

    if (!record || record.purpose !== "unsubscribe") {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_TOKEN", message: "リンクが無効です" } },
        { status: 400 }
      );
    }

    // ユーザーが削除済みの場合は updateMany が 0 件になるだけ (エラーにしない)
    await prisma.user.updateMany({
      where: { id: record.userId },
      data: {
        notifyOnNewEvent: false,
        notifyOnAnnouncement: false,
        notifyOnReminder: false,
        notifyOnEventMessage: false,
      },
    });

    void logActivity({
      userId: record.userId,
      action: "notify_email.unsubscribe",
      entityType: "User",
      entityId: record.userId,
    });

    return NextResponse.json({ success: true, data: {} });
  } catch (error) {
    console.error("Email unsubscribe POST error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "サーバーエラーが発生しました" } },
      { status: 500 }
    );
  }
}
