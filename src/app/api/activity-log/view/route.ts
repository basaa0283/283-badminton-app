import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { logActivity } from "@/lib/activity-log";

// クライアント側からページ表示を記録するための汎用エンドポイント。
// 任意の action を受け付けると荒らされ得るので、ALLOWED に列挙された
// view 系 action のみ通す。
const ALLOWED = new Set([
  "home.view",
  "about.view",
  "release_notes.view",
  "members.list_view",
  "tournaments.list_view",
]);

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED" } },
        { status: 401 },
      );
    }
    const body = await request.json().catch(() => ({}));
    const action = typeof body?.action === "string" ? body.action : "";
    if (!ALLOWED.has(action)) {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_ACTION" } },
        { status: 400 },
      );
    }
    void logActivity({
      userId: session.user.id,
      action,
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("activity-log/view POST error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR" } },
      { status: 500 },
    );
  }
}
