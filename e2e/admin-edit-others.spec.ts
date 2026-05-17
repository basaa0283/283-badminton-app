import { test, expect } from "@playwright/test";
import { adminUserId, loginAs } from "./helpers/auth";

test.describe("管理者による他メンバー編集", () => {
  test.beforeEach(async ({ page }) => {
    const userId = adminUserId();
    test.skip(!userId, "E2E_ADMIN_USER_ID が未設定のためスキップ");
    await loginAs(page, userId!);
  });

  test("admin が他メンバーの nickname / skillLevel / adminNote を更新できる", async ({ page }) => {
    const originalNickname = `E2E_target_${Date.now()}`;
    let targetId: string | undefined;
    try {
      const createRes = await page.request.post("/api/admin/members", {
        data: { nickname: originalNickname },
      });
      targetId = (await createRes.json()).data.id as string;

      const newNickname = `${originalNickname}_updated`;
      const putRes = await page.request.put(`/api/members/${targetId}`, {
        data: {
          nickname: newNickname,
          skillLevel: 5,
          adminNote: "E2E test note",
          role: "member",
        },
      });
      expect(putRes.ok()).toBeTruthy();
      const updated = await putRes.json();
      expect(updated.success).toBe(true);

      // 再取得して値を検証
      const getRes = await page.request.get(`/api/members/${targetId}`);
      const fetched = (await getRes.json()).data;
      expect(fetched.nickname).toBe(newNickname);
      expect(fetched.skillLevel).toBe(5);
      expect(fetched.role).toBe("member");
    } finally {
      if (targetId) {
        await page.request.delete(`/api/admin/members/${targetId}`).catch(() => {});
      }
    }
  });
});
