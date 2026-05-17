import type { Page } from "@playwright/test";

/**
 * dev-login プロバイダで指定ユーザーとしてログインしセッションを確立する。
 * 戻り値の `page` は / 直下にいる。
 *
 * - page.request を使う (page.context() と cookie 共有)。
 * - ログイン後に利用規約への同意も自動で済ませる。
 *   E2E 全テストが TermsAcceptanceGuard で /onboarding/terms に
 *   飛ばされて壊れるのを防ぐため。
 */
export async function loginAs(page: Page, userId: string): Promise<void> {
  const csrfRes = await page.request.get("/api/auth/csrf");
  const { csrfToken } = (await csrfRes.json()) as { csrfToken: string };

  await page.request.post("/api/auth/callback/dev-login", {
    form: {
      csrfToken,
      userId,
      callbackUrl: "/",
      json: "true",
    },
  });

  // 規約同意 (失敗しても致命的ではないので catch して握り潰す)。
  await page.request.post("/api/onboarding/terms").catch(() => {});

  await page.goto("/");
}

/** 環境変数から管理者の userId を取得。未設定時は test.skip と組み合わせる。 */
export function adminUserId(): string | undefined {
  return process.env.E2E_ADMIN_USER_ID;
}
