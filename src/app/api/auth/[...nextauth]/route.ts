import NextAuth from "next-auth";
import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { makeAuthOptions, TenantLineChannel } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DEFAULT_TENANT_SLUG } from "@/lib/tenant";

// マルチテナント P3: リクエストのテナント (middleware がセットする tenant-slug
// cookie) に自前の LINE Login チャネルが登録されていればそれで認証する。
// - 28ばど (デフォルトテナント) とグローバルページ: env のチャネル (従来どおり)
// - チャネル未登録・凍結中のテナント: env にフォールバック
// コールバック URL は全テナント共通 (/api/auth/callback/line) なので、
// 各テナントは自分の LINE チャネルにこの URL を登録するだけでよい。
async function resolveTenantLineChannel(): Promise<TenantLineChannel | undefined> {
  try {
    const store = await cookies();
    const slug = store.get("tenant-slug")?.value;
    if (!slug || slug === DEFAULT_TENANT_SLUG) return undefined;
    const tenant = await prisma.tenant.findUnique({
      where: { slug },
      select: {
        status: true,
        lineLoginChannelId: true,
        lineLoginChannelSecret: true,
      },
    });
    if (!tenant || tenant.status !== "active") return undefined;
    if (!tenant.lineLoginChannelId || !tenant.lineLoginChannelSecret) return undefined;
    return {
      channelId: tenant.lineLoginChannelId,
      channelSecret: tenant.lineLoginChannelSecret,
    };
  } catch (err) {
    console.error("[nextauth] tenant channel resolve failed:", err);
    return undefined;
  }
}

interface RouteContext {
  params: Promise<{ nextauth: string[] }>;
}

async function handler(req: NextRequest, context: RouteContext) {
  const lineChannel = await resolveTenantLineChannel();
  // NextAuth v4 の advanced initialization (リクエストごとにオプションを構築)
  return NextAuth(
    req as unknown as Parameters<typeof NextAuth>[0],
    context as unknown as Parameters<typeof NextAuth>[1],
    makeAuthOptions(lineChannel),
  );
}

export { handler as GET, handler as POST };
