import { test, expect } from "@playwright/test";

const ADMIN_USER_ID = process.env.E2E_ADMIN_USER_ID;

test.describe("smoke", () => {
  test("ログインページが表示される", async ({ page }) => {
    await page.goto("/login");
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("heading")).toBeVisible();
  });

  test("dev-login で管理者ログインしてトップに遷移する", async ({ page, request }) => {
    test.skip(
      !ADMIN_USER_ID,
      "E2E_ADMIN_USER_ID 環境変数が未設定のためスキップ。.env.e2e または CI シークレットで設定してください。"
    );

    // NextAuth の CSRF トークンを取得
    const csrfRes = await request.get("/api/auth/csrf");
    const { csrfToken } = (await csrfRes.json()) as { csrfToken: string };

    // dev-login プロバイダで POST
    await request.post("/api/auth/callback/dev-login", {
      form: {
        csrfToken,
        userId: ADMIN_USER_ID!,
        callbackUrl: "/",
        json: "true",
      },
    });

    await page.goto("/");
    await expect(page).not.toHaveURL(/\/login/);
  });
});
