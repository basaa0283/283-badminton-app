import { test, expect } from "@playwright/test";
import { adminUserId, loginAs } from "./helpers/auth";

test.describe("smoke", () => {
  test("未ログインでトップへアクセスするとログインページへリダイレクト", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login/);
  });

  test("dev-login で管理者ログインしてトップに遷移する", async ({ page, request }) => {
    const userId = adminUserId();
    test.skip(!userId, "E2E_ADMIN_USER_ID が未設定のためスキップ");

    await loginAs(page, request, userId!);
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.getByRole("heading", { name: "283バドミントン" })).toBeVisible();
  });
});
