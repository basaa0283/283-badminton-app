import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { permissions, UserRole } from "@/lib/permissions";

// GET /api/admin/line-notify-targets
// 新規イベント作成時の「メンバーに LINE 通知する」をオンにしたとき、
// 実際に送信される対象人数 (= member 以上 + lineId 連携済み) を返す。
// 誤って大量送信が走らないよう、フォーム側で人数を見せ、確認ダイアログを出すための情報源。
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED" } },
        { status: 401 }
      );
    }
    const role = session.user.role as UserRole;
    if (!permissions.canCreateEvent(role)) {
      return NextResponse.json(
        { success: false, error: { code: "FORBIDDEN" } },
        { status: 403 }
      );
    }

    const count = await prisma.user.count({
      where: {
        role: { in: ["member", "subadmin", "admin"] },
        lineId: { not: null },
      },
    });
    return NextResponse.json({ success: true, data: { count } });
  } catch (error) {
    console.error("GET /api/admin/line-notify-targets error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: String(error) } },
      { status: 500 }
    );
  }
}
