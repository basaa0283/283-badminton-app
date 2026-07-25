import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-log";

const verifySchema = z.object({
  token: z.string().min(1),
});

// メールアドレスをマスク表示用に伏せ字化する (例: "ab***@gmail.com")。
// トークンだけを知る第三者にフルアドレスを開示しないため。
function maskEmail(email: string): string {
  const at = email.indexOf("@");
  if (at <= 0) return "***";
  const local = email.slice(0, at);
  const domain = email.slice(at); // "@..." を含む
  return `${local.slice(0, 2)}***${domain}`;
}

// POST /api/email/verify - 確認メールのリンクから呼ばれる (認証不要)。
// verify トークンが有効なら通知メールを有効化し、配信停止用トークンを発行する。
// GET でなく POST にしているのはメールクライアントの prefetch 誤発火対策。
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = verifySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "トークンが指定されていません" } },
        { status: 400 }
      );
    }

    const record = await prisma.emailToken.findUnique({
      where: { token: parsed.data.token },
    });

    const invalidResponse = NextResponse.json(
      { success: false, error: { code: "INVALID_TOKEN", message: "リンクが無効か、期限切れです" } },
      { status: 400 }
    );

    if (
      !record ||
      record.purpose !== "verify" ||
      !record.expiresAt ||
      record.expiresAt.getTime() < Date.now()
    ) {
      return invalidResponse;
    }

    const user = await prisma.user.findUnique({
      where: { id: record.userId },
      select: { id: true, notifyEmail: true },
    });
    // 登録解除済みなどでアドレスが無い場合も無効扱い
    if (!user?.notifyEmail) {
      return invalidResponse;
    }

    // 配信停止用トークン (無期限)。全通知メールのフッターに載せる。
    const unsubscribeToken = crypto.randomBytes(32).toString("hex");

    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { notifyEmailVerifiedAt: new Date() },
      }),
      // verify トークンはワンタイム: 使用後は全削除
      prisma.emailToken.deleteMany({
        where: { userId: user.id, purpose: "verify" },
      }),
      // 古い unsubscribe トークンがあれば入れ替える
      prisma.emailToken.deleteMany({
        where: { userId: user.id, purpose: "unsubscribe" },
      }),
      prisma.emailToken.create({
        data: {
          token: unsubscribeToken,
          userId: user.id,
          purpose: "unsubscribe",
          expiresAt: null,
        },
      }),
    ]);

    void logActivity({
      userId: user.id,
      action: "notify_email.verify",
      entityType: "User",
      entityId: user.id,
    });

    return NextResponse.json({
      success: true,
      data: { email: maskEmail(user.notifyEmail) },
    });
  } catch (error) {
    console.error("Email verify POST error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "サーバーエラーが発生しました" } },
      { status: 500 }
    );
  }
}
