import { test, expect } from "@playwright/test";
import { adminUserId, loginAs } from "./helpers/auth";

test.describe("管理画面 メンバー編集 (admin)", () => {
  test.beforeEach(async ({ page }) => {
    const userId = adminUserId();
    test.skip(!userId, "E2E_ADMIN_USER_ID が未設定のためスキップ");
    await loginAs(page, userId!);
  });

  // v1.3.0 修正: role を変更していなくても「自分自身の権限は変更できません」エラーで保存できない不具合のリグレッション
  test("管理者が自分自身の情報を role 据置きで保存できる", async ({ page }) => {
    const userId = adminUserId()!;

    // 現状の自分の情報を取得
    const getRes = await page.request.get(`/api/members/${userId}`);
    expect(getRes.ok()).toBeTruthy();
    const current = await getRes.json();
    expect(current.success).toBe(true);

    // role を据置きで PUT
    const putRes = await page.request.put(`/api/members/${userId}`, {
      data: {
        nickname: current.data.nickname,
        role: current.data.role, // 同じrole
        comment: current.data.comment ?? undefined,
      },
    });
    expect(putRes.ok()).toBeTruthy();
    const updated = await putRes.json();
    expect(updated.success).toBe(true);
  });

  test("管理者が自分自身の role を変更しようとすると 403 になる", async ({ page }) => {
    const userId = adminUserId()!;

    // 現状の自分の role を取得
    const getRes = await page.request.get(`/api/members/${userId}`);
    const current = await getRes.json();
    const currentRole = current.data.role as string;

    // role を変更しようとする
    const newRole = currentRole === "admin" ? "member" : "admin";
    const putRes = await page.request.put(`/api/members/${userId}`, {
      data: {
        nickname: current.data.nickname,
        role: newRole,
      },
    });
    expect(putRes.status()).toBe(403);
  });
});
