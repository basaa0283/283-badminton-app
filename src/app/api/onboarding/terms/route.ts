import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CURRENT_TERMS_VERSION } from "@/lib/legal";
import { sendAdminNotification } from "@/lib/email";

// POST /api/onboarding/terms - 現行バージョンの利用規約・PP に同意
//
// 認証必要。同意したユーザーの termsAcceptedAt / termsAcceptedVersion を更新。
// バージョンを上げたら全ユーザーが再同意する仕様。
export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED" } },
        { status: 401 }
      );
    }

    const updated = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        termsAcceptedAt: new Date(),
        termsAcceptedVersion: CURRENT_TERMS_VERSION,
      },
      select: {
        id: true,
        nickname: true,
        role: true,
      },
    });

    // role が pending のまま規約同意した = 自力で来たゲストの参加リクエスト確定。
    // 招待リンク経由は /invite/complete で role=member に昇格済みなので、
    // ここを通過するときには role は member などになっており、この条件には引っかからない。
    if (updated.role === "pending") {
      const baseUrl =
        process.env.NEXTAUTH_URL ||
        "https://dev-283-badminton-app-dae7h5bjbddcdnd3.japaneast-01.azurewebsites.net";
      // メール送信は非同期で fire-and-forget (規約同意レスポンスを遅延させない)
      void sendAdminNotification({
        subject: `[283-badminton-app] 参加リクエストが届いています (${updated.nickname})`,
        body: [
          `${updated.nickname} さんから参加リクエストが届いています。`,
          ``,
          `管理画面でロールを付与して承認、または却下してください:`,
          `${baseUrl}/admin/members`,
        ].join("\n"),
      });
    }

    return NextResponse.json({
      success: true,
      data: { termsAcceptedVersion: CURRENT_TERMS_VERSION },
    });
  } catch (error) {
    console.error("POST /api/onboarding/terms error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: String(error) } },
      { status: 500 }
    );
  }
}
