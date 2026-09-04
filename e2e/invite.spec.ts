import { test, expect } from "@playwright/test";
import { adminUserId, loginAs } from "./helpers/auth";

test.describe("招待リンク発行 (admin)", () => {
  test.beforeEach(async ({ page }) => {
    const userId = adminUserId();
    test.skip(!userId, "E2E_ADMIN_USER_ID が未設定のためスキップ");
    await loginAs(page, userId!);
  });

  test("UI で仮アカウント作成→招待リンク発行→クリーンアップ", async ({ page }) => {
    const nickname = `E2E_test_${Date.now()}`;

    let userId: string | undefined;
    try {
      // 管理画面のメンバー一覧へ
      await page.goto("/283bad/admin/members");

      // 仮アカウント作成 UI を開く
      await page.getByRole("button", { name: "+ 仮アカウント作成" }).click();
      await page.getByPlaceholder("ニックネーム（例：田中さん）").fill(nickname);
      await page.getByRole("button", { name: "作成", exact: true }).click();

      // 仮メンバーの詳細ページに遷移する
      await expect(page).toHaveURL(/\/admin\/members\/[^/]+$/);
      userId = page.url().split("/").pop();
      expect(userId).toBeTruthy();

      // 招待リンク発行ボタン
      await page.getByRole("button", { name: "招待リンクを発行する" }).click();

      // 発行された招待URLが画面に表示される
      await expect(page.getByText(/\/invite\//)).toBeVisible();
      await expect(page.getByRole("button", { name: /URLをコピー/ })).toBeVisible();
    } finally {
      // クリーンアップ: API でユーザー削除（招待トークンは別途削除）
      if (userId) {
        await page.request.delete(`/api/admin/invitations/${userId}`).catch(() => {});
        await page.request.delete(`/api/admin/members/${userId}`).catch(() => {});
      }
    }
  });
});
