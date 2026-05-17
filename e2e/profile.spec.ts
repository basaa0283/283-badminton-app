import { test, expect } from "@playwright/test";
import { adminUserId, loginAs } from "./helpers/auth";

test.describe("プロフィール", () => {
  test.beforeEach(async ({ page }) => {
    const userId = adminUserId();
    test.skip(!userId, "E2E_ADMIN_USER_ID が未設定のためスキップ");
    await loginAs(page, userId!);
  });

  test("自分のプロフィールを取得して更新できる (元の値に復元)", async ({ page }) => {
    // 現在値を取得
    const getRes = await page.request.get("/api/profile");
    expect(getRes.ok()).toBeTruthy();
    const before = (await getRes.json()).data;

    const testMarker = `E2E_${Date.now()}`;
    try {
      // comment を一時的に書き換え
      const putRes = await page.request.put("/api/profile", {
        data: {
          nickname: before.nickname,
          firstName: before.firstName ?? undefined,
          lastName: before.lastName ?? undefined,
          gender: before.gender ?? undefined,
          age: before.age ?? undefined,
          ageVisible: before.ageVisible,
          comment: testMarker,
        },
      });
      expect(putRes.ok()).toBeTruthy();
      const updated = (await putRes.json()).data;
      expect(updated.comment).toBe(testMarker);

      // GET で反映を確認
      const reRes = await page.request.get("/api/profile");
      expect((await reRes.json()).data.comment).toBe(testMarker);
    } finally {
      // 元に戻す（失敗時にもプロフィールを壊さないため必ず実行）
      await page.request.put("/api/profile", {
        data: {
          nickname: before.nickname,
          firstName: before.firstName ?? undefined,
          lastName: before.lastName ?? undefined,
          gender: before.gender ?? undefined,
          age: before.age ?? undefined,
          ageVisible: before.ageVisible,
          comment: before.comment ?? undefined,
        },
      });
    }
  });
});
