import { test, expect } from "@playwright/test";
import { adminUserId, loginAs } from "./helpers/auth";

test.describe("代理出欠登録 (admin)", () => {
  test.beforeEach(async ({ page }) => {
    const userId = adminUserId();
    test.skip(!userId, "E2E_ADMIN_USER_ID が未設定のためスキップ");
    await loginAs(page, userId!);
  });

  // v1.3.0 修正: 対象メンバーが既に参加/不参加を回答していてもボタンが未選択状態で表示されていた問題のリグレッション
  test("既存の回答が代理出欠UIで選択状態として表示される", async ({ page }) => {
    const eventTitle = `E2E proxy ${Date.now()}`;
    const memberNickname = `E2E_proxy_member_${Date.now()}`;
    const eventDate = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    let eventId: string | undefined;
    let memberId: string | undefined;
    try {
      // テストイベント作成
      const eventRes = await page.request.post("/api/events", {
        data: { title: eventTitle, eventDate, notifyMembers: false },
      });
      const event = await eventRes.json();
      expect(event.success).toBe(true);
      eventId = event.data.id as string;

      // テストメンバー作成 (visitor 仮アカウント)
      const memberRes = await page.request.post("/api/admin/members", {
        data: { nickname: memberNickname },
      });
      const member = await memberRes.json();
      expect(member.success).toBe(true);
      memberId = member.data.id as string;

      // 既存の代理出欠 (参加) を API で先に登録
      const proxyRes = await page.request.post(`/api/admin/members/${memberId}/attendance`, {
        data: { eventId, status: "attending" },
      });
      const proxy = await proxyRes.json();
      expect(proxy.success).toBe(true);

      // 管理画面のメンバー詳細を開く
      await page.goto(`/admin/members/${memberId}`);
      await expect(page.getByText(memberNickname)).toBeVisible();

      // 代理出欠セクションを特定（対象イベントタイトル含むカード）
      const eventCard = page.locator("div", { hasText: eventTitle }).first();

      // 参加ボタンが選択状態 (bg-green-500) になっているはず
      const attendingButton = eventCard.getByRole("button", { name: "参加", exact: true });
      await expect(attendingButton).toHaveClass(/bg-green-500/);
      // 不参加ボタンは未選択
      const notAttendingButton = eventCard.getByRole("button", { name: "不参加", exact: true });
      await expect(notAttendingButton).not.toHaveClass(/bg-red-500/);
    } finally {
      if (memberId) {
        await page.request.delete(`/api/admin/members/${memberId}`).catch(() => {});
      }
      if (eventId) {
        await page.request.delete(`/api/events/${eventId}`).catch(() => {});
      }
    }
  });
});
