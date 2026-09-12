import { test, expect } from "@playwright/test";
import { adminUserId, loginAs } from "./helpers/auth";

test.describe("主要ページのナビゲーション (admin)", () => {
  test.beforeEach(async ({ page }) => {
    const userId = adminUserId();
    test.skip(!userId, "E2E_ADMIN_USER_ID が未設定のためスキップ");
    await loginAs(page, userId!);
  });

  test("トップから各ページに遷移できる", async ({ page }) => {
    // home now includes header nav + card with same href, so target the first match
    await expect(page.locator('a[href="/events"]').first()).toBeVisible();

    await page.locator('a[href="/events"]').first().click();
    await expect(page).toHaveURL(/\/events/);
    await expect(page.getByRole("heading", { name: "イベント" })).toBeVisible();

    await page.goto("/28bad");
    await page.locator('a[href="/members"]').first().click();
    await expect(page).toHaveURL(/\/members/);

    await page.goto("/28bad");
    await page.locator('a[href="/profile"]').first().click();
    await expect(page).toHaveURL(/\/profile/);

    await page.goto("/28bad");
    await page.locator('a[href="/admin"]').first().click();
    await expect(page).toHaveURL(/\/admin/);
  });

  test("イベント一覧ページ: 今後/過去タブが切り替えできる", async ({ page }) => {
    await page.goto("/28bad/events");
    await page.getByRole("button", { name: "今後のイベント" }).click();
    await expect(page.getByRole("button", { name: "今後のイベント" })).toHaveClass(/bg-blue-600/);
    await page.getByRole("button", { name: "過去のイベント" }).click();
    await expect(page.getByRole("button", { name: "過去のイベント" })).toHaveClass(/bg-blue-600/);
  });

  test("メンバー一覧ページが表示される (admin)", async ({ page }) => {
    await page.goto("/28bad/members");
    await expect(page).toHaveURL(/\/members/);
    // ヘッダーかタイトルがあること
    await expect(page.locator("main")).toBeVisible();
  });

  test("管理ページが表示される (admin)", async ({ page }) => {
    await page.goto("/28bad/admin");
    await expect(page).toHaveURL(/\/admin/);
    await expect(page.locator("main")).toBeVisible();
  });
});
