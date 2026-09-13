import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePlatformAdmin } from "@/lib/platform-admin";
import { logActivity } from "@/lib/activity-log";

interface Params {
  params: Promise<{ tenantId: string }>;
}

// GET /api/platform/tenants/[tenantId]/line-channel
// 設定の有無だけ返す (シークレット類は絶対にレスポンスへ載せない)
export async function GET(_request: NextRequest, { params }: Params) {
  const auth = await requirePlatformAdmin();
  if (!auth.ok) return auth.response;

  try {
    const { tenantId } = await params;
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        lineLoginChannelId: true,
        lineLoginChannelSecret: true,
        lineMessagingChannelId: true,
        lineMessagingChannelSecret: true,
        lineMessagingAccessToken: true,
      },
    });
    if (!tenant) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND" } },
        { status: 404 },
      );
    }
    return NextResponse.json({
      success: true,
      data: {
        // channelId は識別子なので表示してよい。シークレットは有無のみ
        lineLoginChannelId: tenant.lineLoginChannelId,
        hasLineLoginSecret: !!tenant.lineLoginChannelSecret,
        lineMessagingChannelId: tenant.lineMessagingChannelId,
        hasLineMessagingSecret: !!tenant.lineMessagingChannelSecret,
        hasLineMessagingAccessToken: !!tenant.lineMessagingAccessToken,
      },
    });
  } catch (error) {
    console.error("line-channel GET error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "サーバーエラーが発生しました" } },
      { status: 500 },
    );
  }
}

// PUT /api/platform/tenants/[tenantId]/line-channel
// 送られたフィールドだけ更新する。空文字は「クリア (null)」の意味。
// undefined (未送信) のフィールドは変更しない (シークレットの再入力を強制しないため)。
export async function PUT(request: NextRequest, { params }: Params) {
  const auth = await requirePlatformAdmin();
  if (!auth.ok) return auth.response;

  try {
    const { tenantId } = await params;
    const body = await request.json();

    const fields = [
      "lineLoginChannelId",
      "lineLoginChannelSecret",
      "lineMessagingChannelId",
      "lineMessagingChannelSecret",
      "lineMessagingAccessToken",
    ] as const;

    const data: Record<string, string | null> = {};
    for (const f of fields) {
      const v = body?.[f];
      if (v === undefined) continue;
      if (typeof v !== "string") {
        return NextResponse.json(
          { success: false, error: { code: "VALIDATION_ERROR", message: `${f} は文字列で指定してください` } },
          { status: 400 },
        );
      }
      data[f] = v.trim() === "" ? null : v.trim();
    }
    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "更新するフィールドがありません" } },
        { status: 400 },
      );
    }

    const existing = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, slug: true },
    });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND" } },
        { status: 404 },
      );
    }

    await prisma.tenant.update({ where: { id: tenantId }, data });
    void logActivity({
      userId: auth.userId,
      action: "platform.tenant_line_channel_update",
      entityType: "Tenant",
      entityId: tenantId,
      // シークレット値はログに残さない。更新したフィールド名のみ
      metadata: { slug: existing.slug, updatedFields: Object.keys(data) },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("line-channel PUT error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "サーバーエラーが発生しました" } },
      { status: 500 },
    );
  }
}
