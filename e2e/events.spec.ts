import { test, expect } from "@playwright/test";
import { adminUserId, loginAs } from "./helpers/auth";

test.describe("イベント (admin)", () => {
  test.beforeEach(async ({ page }) => {
    const userId = adminUserId();
    test.skip(!userId, "E2E_ADMIN_USER_ID が未設定のためスキップ");
    await loginAs(page, userId!);
  });

  test("API でイベント作成 → 一覧に表示 → 削除でクリーンアップ", async ({ page }) => {
    const title = `E2E test event ${Date.now()}`;
    // 30分後を開始時刻に設定（"今後のイベント" タブで拾えるように）
    const eventDate = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    let eventId: string | undefined;
    try {
      // 作成
      const createRes = await page.request.post("/api/events", {
        data: {
          title,
          eventDate,
          location: "E2E テストコート",
          notifyMembers: false,
        },
      });
      const created = await createRes.json();
      expect(created.success).toBe(true);
      eventId = created.data.id as string;

      // 一覧に表示されること
      await page.goto("/283bad/events");
      await expect(page.getByText(title)).toBeVisible();

      // 詳細ページに遷移できること
      await page.getByText(title).click();
      await expect(page).toHaveURL(/\/events\/[^/]+$/);
      await expect(page.getByText(title)).toBeVisible();
    } finally {
      // クリーンアップ
      if (eventId) {
        const deleteRes = await page.request.delete(`/api/events/${eventId}`);
        expect(deleteRes.ok()).toBeTruthy();
      }
    }
  });
});
