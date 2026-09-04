import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "./auth";

// プラットフォーム管理 API (/api/platform/*) の共通ガード。
// User.isPlatformAdmin=true のユーザーのみ許可。テナント内 role (admin 等) とは無関係。
export async function requirePlatformAdmin(): Promise<
  | { ok: true; userId: string }
  | { ok: false; response: NextResponse }
> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED" } },
        { status: 401 },
      ),
    };
  }
  if (!session.user.isPlatformAdmin) {
    // 存在を隠すため 404 にする (プラットフォーム管理の存在自体を一般ユーザーに見せない)
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: { code: "NOT_FOUND" } },
        { status: 404 },
      ),
    };
  }
  return { ok: true, userId: session.user.id };
}

// テナント slug として使えない予約語 (ルーティングと衝突するパス + 将来使う語)
export const RESERVED_SLUGS = new Set([
  "platform", "api", "login", "about", "preview", "terms", "privacy",
  "email", "invite", "onboarding", "events", "members", "admin",
  "tournaments", "profile", "release-notes", "auth", "www", "app",
]);

export const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{2,29}$/;

export const TENANT_PLANS = new Set(["free", "paid", "complimentary"]);
export const TENANT_STATUSES = new Set(["active", "frozen", "pending"]);
