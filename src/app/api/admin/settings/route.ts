import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { permissions, UserRole } from "@/lib/permissions";
import { getDefaultTenantId } from "@/lib/tenant";

const BOOLEAN_KEYS = ["notifyReminderEnabled", "notifyWaitlistEnabled"] as const;
const STRING_KEYS = [
  "contactEmail",
  "officialLineUrl",
  "instagramUrl",
  "youtubeUrl",
  "aboutPageContent",
  // "fifo" (デフォルト・先着順) | "priority" (User.priorityScore 順)
  "waitlistPolicy",
  // 参加費の PayPay 送金先 (PayPay ID)。PayPay の個人 QR / リンクは期限が
  // あるが、PayPay ID は半永久的に固定なので、これを 1 つ持って全イベント
  // で「ここに送ってね」と案内する。
  "paypayPersonalId",
  // 参加リクエスト保留時に LINE で送るテンプレ文。空のときは
  // src/lib/line-messaging.ts の HOLD_REPLY_DEFAULT が使われる。
  "holdReplyMessage",
] as const;
type BooleanKey = (typeof BOOLEAN_KEYS)[number];
type StringKey = (typeof STRING_KEYS)[number];

// GET /api/admin/settings
export async function GET(_request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ success: false, error: { code: "UNAUTHORIZED" } }, { status: 401 });
    }
    if (!permissions.canAccessAdmin(session.user.role as UserRole)) {
      return NextResponse.json({ success: false, error: { code: "FORBIDDEN" } }, { status: 403 });
    }

    const allKeys = [...BOOLEAN_KEYS, ...STRING_KEYS];
    const settings = await prisma.systemSetting.findMany({
      where: { key: { in: allKeys } },
    });
    const map = Object.fromEntries(settings.map((s) => [s.key, s.value]));

    const data: Record<string, boolean | string> = {};
    for (const key of BOOLEAN_KEYS) {
      data[key] = map[key] !== "false";
    }
    for (const key of STRING_KEYS) {
      data[key] = map[key] ?? "";
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("GET /api/admin/settings error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "サーバーエラーが発生しました" } },
      { status: 500 }
    );
  }
}

// PUT /api/admin/settings
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ success: false, error: { code: "UNAUTHORIZED" } }, { status: 401 });
    }
    if (!permissions.canAccessAdmin(session.user.role as UserRole)) {
      return NextResponse.json({ success: false, error: { code: "FORBIDDEN" } }, { status: 403 });
    }

    const body = await request.json();
    const tenantId = await getDefaultTenantId();

    for (const key of BOOLEAN_KEYS) {
      if (typeof body[key] === "boolean") {
        await prisma.systemSetting.upsert({
          where: { key },
          update: { value: String(body[key]) },
          create: { key, value: String(body[key]), tenantId },
        });
      }
    }
    for (const key of STRING_KEYS) {
      if (typeof body[key] === "string") {
        const value = body[key] as string;
        await prisma.systemSetting.upsert({
          where: { key },
          update: { value },
          create: { key, value, tenantId },
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PUT /api/admin/settings error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "サーバーエラーが発生しました" } },
      { status: 500 }
    );
  }
}
