import { test, expect } from "@playwright/test";
import { adminUserId, loginAs } from "./helpers/auth";

test.describe("出欠登録", () => {
  test.beforeEach(async ({ page }) => {
    const userId = adminUserId();
    test.skip(!userId, "E2E_ADMIN_USER_ID が未設定のためスキップ");
    await loginAs(page, userId!);
  });

  test("イベント詳細から参加→不参加に切り替えできる", async ({ page }) => {
    const title = `E2E attendance ${Date.now()}`;
    const eventDate = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    let eventId: string | undefined;
    try {
      const createRes = await page.request.post("/api/events", {
        data: { title, eventDate, notifyMembers: false },
      });
      const created = await createRes.json();
      expect(created.success).toBe(true);
      eventId = created.data.id as string;

      await page.goto(`/events/${eventId}`);
      await expect(page.getByText(title)).toBeVisible();

      // AttendanceForm に絞る (AdminAttendanceManager の 参加/不参加 ボタンと区別)
      const attendanceForm = page.locator("form").filter({ hasText: "出欠" });

      // 参加を選択して送信
      await attendanceForm.getByRole("button", { name: "参加", exact: true }).click();
      await page.getByRole("button", { name: "回答を送信する" }).click();
      await expect(page.getByRole("button", { name: "回答を更新する" })).toBeVisible();

      // 不参加に切り替えて更新
      await attendanceForm.getByRole("button", { name: "不参加", exact: true }).click();
      await page.getByRole("button", { name: "回答を更新する" }).click();

      // 更新が成功してフォームが再描画される
      await expect(page.getByRole("button", { name: "回答を更新する" })).toBeVisible();
    } finally {
      if (eventId) {
        const deleteRes = await page.request.delete(`/api/events/${eventId}`);
        expect(deleteRes.ok()).toBeTruthy();
      }
    }
  });
});
