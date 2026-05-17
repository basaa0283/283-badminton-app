import { test, expect } from "@playwright/test";
import { adminUserId, loginAs } from "./helpers/auth";

test.describe("管理画面メンバー一覧の guest 表示", () => {
  // v1.3.0 修正: 管理画面のメンバー一覧でゲスト権限のアカウントも表示
  test("guest 権限のユーザーが GET /api/members に含まれる", async ({ page }) => {
    const admin = adminUserId();
    test.skip(!admin, "E2E_ADMIN_USER_ID が未設定のためスキップ");
    await loginAs(page, admin!);

    const nickname = `E2E_guest_${Date.now()}`;
    let userId: string | undefined;
    try {
      // 仮アカウント (visitor) として作成
      const createRes = await page.request.post("/api/admin/members", {
        data: { nickname },
      });
      userId = (await createRes.json()).data.id as string;

      // guest に変更
      const putRes = await page.request.put(`/api/members/${userId}`, {
        data: { nickname, role: "guest" },
      });
      expect(putRes.ok()).toBeTruthy();

      // メンバー一覧 API
      const listRes = await page.request.get("/api/members");
      expect(listRes.ok()).toBeTruthy();
      const list = await listRes.json();
      const found = list.data.find((m: { id: string }) => m.id === userId);
      expect(found).toBeDefined();
      expect(found.role).toBe("guest");
    } finally {
      if (userId) {
        await page.request.delete(`/api/admin/members/${userId}`).catch(() => {});
      }
    }
  });
});
