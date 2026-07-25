import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { permissions, UserRole } from "@/lib/permissions";

// GET /api/admin/line-quota
// LINE Messaging API の月次送信枠 (quota) と今月の消費 (consumption) を取得する。
// - quota.type === "limited": フリープラン or ライト/スタンダードで上限あり。value が上限通数
// - quota.type === "none":    上限なしプラン
// 取得失敗時 (TOKEN 未設定など) は { configured: false } を返す。
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED" } },
        { status: 401 },
      );
    }
    const role = session.user.role as UserRole;
    if (!permissions.canAccessAdmin(role)) {
      return NextResponse.json(
        { success: false, error: { code: "FORBIDDEN" } },
        { status: 403 },
      );
    }

    const token = process.env.LINE_MESSAGING_API_CHANNEL_ACCESS_TOKEN;
    if (!token) {
      return NextResponse.json({
        success: true,
        data: { configured: false },
      });
    }

    const headers = { Authorization: `Bearer ${token}` };
    const [quotaRes, consumptionRes] = await Promise.all([
      fetch("https://api.line.me/v2/bot/message/quota", { headers }),
      fetch("https://api.line.me/v2/bot/message/quota/consumption", { headers }),
    ]);

    if (!quotaRes.ok || !consumptionRes.ok) {
      return NextResponse.json({
        success: false,
        error: {
          code: "LINE_API_ERROR",
          message: `quota=${quotaRes.status} consumption=${consumptionRes.status}`,
        },
      }, { status: 502 });
    }

    const quota = (await quotaRes.json()) as { type: string; value?: number };
    const consumption = (await consumptionRes.json()) as { totalUsage: number };

    const limit = quota.type === "limited" ? (quota.value ?? null) : null;
    const used = consumption.totalUsage;
    const remaining = limit !== null ? Math.max(0, limit - used) : null;

    return NextResponse.json({
      success: true,
      data: {
        configured: true,
        quotaType: quota.type,
        limit,
        used,
        remaining,
      },
    });
  } catch (error) {
    console.error("line-quota GET error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "サーバーエラーが発生しました" } },
      { status: 500 },
    );
  }
}
