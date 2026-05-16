import type { Page, APIRequestContext } from "@playwright/test";

/**
 * dev-login プロバイダで指定ユーザーとしてログインしセッションを確立する。
 * 戻り値の `page` は / 直下にいる。
 */
export async function loginAs(
  page: Page,
  request: APIRequestContext,
  userId: string
): Promise<void> {
  const csrfRes = await request.get("/api/auth/csrf");
  const { csrfToken } = (await csrfRes.json()) as { csrfToken: string };

  await request.post("/api/auth/callback/dev-login", {
    form: {
      csrfToken,
      userId,
      callbackUrl: "/",
      json: "true",
    },
  });

  await page.goto("/");
}

/** 環境変数から管理者の userId を取得。未設定時は test.skip と組み合わせる。 */
export function adminUserId(): string | undefined {
  return process.env.E2E_ADMIN_USER_ID;
}
